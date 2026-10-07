import { io, type Socket } from "socket.io-client";

/**
 * Identifies this browser tab. The API client sends it with every request, so live notices about
 * a change can be ignored by the tab that made it.
 */
export const TAB_ID: string = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/** Header carrying `TAB_ID`; Core reads it for data package change notices. */
export const TAB_HEADER = "X-OpenMeshTak-Tab";

/**
 * Opens a live connection to one of Core's realtime namespaces on the same origin. The browser
 * sends the session cookie with the handshake, and the socket reconnects by itself.
 */
export function connectRealtime(namespace: string, auth: Record<string, string> = {}): Socket {
  // Each caller owns its socket; a shared, cached one would be closed by whichever view leaves first.
  return io(namespace, { path: "/api/realtime", auth, withCredentials: true, forceNew: true });
}
