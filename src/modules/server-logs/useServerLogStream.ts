import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import type { Socket } from "socket.io-client";
import { describeError } from "@/shared/errors/api-problem";
import { connectServerLogStream, listServerLogs, type ServerLogEntryDto } from "./server-logs.api";

/** Lines kept in the browser; Core itself keeps about as many. */
const MAX_ENTRIES = 2000;

export type StreamStatus = "connecting" | "live" | "reconnecting" | "denied" | "error";

/**
 * The server log: history over the API, then live lines over the socket. After a reconnect the
 * history request with the last sequence fills the gap; lines pushed meanwhile are merged by
 * sequence, so none appears twice. While paused, new lines wait and are added on resume.
 */
export function useServerLogStream() {
  const entries = shallowRef<ServerLogEntryDto[]>([]);
  const held = shallowRef<ServerLogEntryDto[]>([]);
  const status = ref<StreamStatus>("connecting");
  const error = ref("");
  const paused = ref(false);
  let latest: number | undefined;
  let loadingHistory = false;
  let pending: ServerLogEntryDto[] = [];
  let socket: Socket | null = null;

  function append(lines: ServerLogEntryDto[]): void {
    const fresh = lines.filter(({ sequence }) => latest === undefined || sequence > latest);
    if (fresh.length === 0) {
      return;
    }
    latest = fresh.at(-1)?.sequence ?? latest;
    if (paused.value) {
      held.value = [...held.value, ...fresh].slice(-MAX_ENTRIES);
    } else {
      entries.value = [...entries.value, ...fresh].slice(-MAX_ENTRIES);
    }
  }

  async function loadHistory(): Promise<void> {
    loadingHistory = true;
    try {
      const page = await listServerLogs(latest);
      if (page.reset) {
        // Core restarted, or this is the first load: start a fresh view.
        latest = undefined;
        entries.value = [];
        held.value = [];
      }
      append(page.items);
      append(pending);
      status.value = "live";
    } catch (caught: unknown) {
      error.value = describeError(caught);
      status.value = "error";
    } finally {
      pending = [];
      loadingHistory = false;
    }
  }

  function pause(): void {
    paused.value = true;
  }

  function resume(): void {
    paused.value = false;
    entries.value = [...entries.value, ...held.value].slice(-MAX_ENTRIES);
    held.value = [];
  }

  function clear(): void {
    entries.value = [];
    held.value = [];
  }

  onMounted(() => {
    socket = connectServerLogStream();
    socket.on("connect", () => void loadHistory());
    socket.on("line", (line: ServerLogEntryDto) => {
      if (loadingHistory) {
        pending.push(line);
      } else {
        append([line]);
      }
    });
    socket.on("disconnect", () => {
      status.value = "reconnecting";
    });
    socket.on("connect_error", (connectError: Error) => {
      if (connectError.message === "Access denied") {
        status.value = "denied";
        socket?.disconnect();
      } else {
        status.value = "reconnecting";
      }
    });
  });

  onBeforeUnmount(() => {
    socket?.disconnect();
  });

  return { entries, held, status, error, paused, pause, resume, clear };
}
