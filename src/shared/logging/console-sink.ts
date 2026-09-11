import type { LogMetadata } from "./sanitize.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** The only module allowed to write to the browser console; it receives sanitized data only. */
export function writeToConsole(level: LogLevel, message: string, metadata: LogMetadata): void {
  console[level](`[openmeshtak] ${message}`, metadata);
}
