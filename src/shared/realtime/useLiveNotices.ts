import type { Socket } from "socket.io-client";
import { onBeforeUnmount, onMounted } from "vue";
import { connectRealtime, TAB_ID } from "./realtime";

interface Options {
  /** Handshake payload, e.g. `{ eventId }`; `null` keeps the socket closed. */
  auth?: () => Record<string, string> | null;
  /** Skip notices about changes this tab made itself (they carry its `tabId`). */
  ignoreOwnTab?: boolean;
  /** Bursts of notices within this time cause one call. */
  delayMs?: number;
}

/**
 * Calls `onNotice` when Core announces `event` in `namespace`, for views that reload their data
 * when something changed elsewhere. The socket lives as long as the component; `reconnect` opens
 * it again, e.g. after the watched event changed.
 */
export function useLiveNotices(namespace: string, event: string, onNotice: () => void, options: Options = {}) {
  let socket: Socket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function close(): void {
    socket?.disconnect();
    socket = null;
    clearTimeout(timer);
  }

  function reconnect(): void {
    close();
    const auth = options.auth === undefined ? {} : options.auth();
    if (auth === null) {
      return;
    }
    socket = connectRealtime(namespace, auth);
    socket.on(event, (notice: { tabId?: string | null } | undefined) => {
      if (options.ignoreOwnTab === true && notice?.tabId === TAB_ID) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(onNotice, options.delayMs ?? 400);
    });
  }

  onMounted(reconnect);
  onBeforeUnmount(close);
  return { reconnect };
}
