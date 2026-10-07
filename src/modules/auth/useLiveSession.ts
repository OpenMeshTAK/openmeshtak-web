import type { Socket } from "socket.io-client";
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/shared/feedback/toast";
import { connectRealtime } from "@/shared/realtime/realtime";
import { checkCoreVersion } from "@/shared/version/core-version";
import { useSession } from "./session";

/** A short interruption, such as a reconnect, is not worth a warning. */
const LOST_AFTER_MS = 3000;

/**
 * One live connection per signed-in tab. Core asks the tab to check its session when an
 * administrator ended it or disabled the account, so the tab signs out right away. Every
 * reconnect, e.g. after a Core update, checks the session and the server version again.
 * `connectionLost` is true while Core has been unreachable for a few seconds.
 */
export function useLiveSession() {
  const session = useSession();
  const router = useRouter();
  const toast = useToast();
  const connectionLost = ref(false);
  let socket: Socket | null = null;
  let lostTimer: ReturnType<typeof setTimeout> | undefined;

  function markLost(): void {
    lostTimer ??= setTimeout(() => {
      connectionLost.value = true;
    }, LOST_AFTER_MS);
  }

  function markConnected(): void {
    clearTimeout(lostTimer);
    lostTimer = undefined;
    connectionLost.value = false;
  }

  async function checkSession(): Promise<void> {
    try {
      await session.refresh();
    } catch {
      return; // Core is unreachable; the reconnect checks again.
    }
    if (session.state.status !== "authenticated") {
      close();
      toast.warning("Your session ended. Please sign in again.");
      await router.push({ name: "sign-in", query: { redirect: router.currentRoute.value.fullPath } });
    } else if (socket?.connected === false && socket.active === false) {
      // The server closed the socket, e.g. after a failed recheck, but the session is fine.
      socket.connect();
    }
  }

  function open(): void {
    if (socket !== null) {
      return;
    }
    let connectedBefore = false;
    socket = connectRealtime("/session");
    socket.on("check-session", () => void checkSession());
    socket.on("connect", () => {
      markConnected();
      if (connectedBefore) {
        void checkSession();
        void checkCoreVersion();
      }
      connectedBefore = true;
    });
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        void checkSession();
      } else if (reason !== "io client disconnect") {
        markLost();
      }
    });
    socket.on("connect_error", (error: Error) => {
      if (error.message === "Access denied") {
        void checkSession();
      } else {
        markLost();
      }
    });
  }

  function close(): void {
    socket?.disconnect();
    socket = null;
    markConnected();
  }

  watch(
    () => session.state.status,
    (status) => {
      if (status === "authenticated") {
        open();
      } else {
        close();
      }
    },
    { immediate: true },
  );

  return { connectionLost };
}
