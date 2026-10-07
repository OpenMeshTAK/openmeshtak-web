import type { Socket } from "socket.io-client";
import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";
import { connectRealtime } from "@/shared/realtime/realtime";

export type ServerLogEntryDto = Schemas["ServerLogEntryDto"];
export type ServerLogLevel = Schemas["ServerLogLevel"];
export type ServerLogPage = Schemas["ServerLogPage"];

/** Core's newest log lines, or only those after `after`. */
export function listServerLogs(after?: number): Promise<ServerLogPage> {
  return unwrap(api.GET("/server-logs", { params: { query: after === undefined ? {} : { after } } }));
}

/**
 * Live log lines pushed by Core. The browser sends the session cookie with the handshake; the
 * socket reconnects by itself after network or server interruptions.
 */
export function connectServerLogStream(): Socket {
  return connectRealtime("/server-logs");
}
