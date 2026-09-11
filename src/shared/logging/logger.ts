import { writeToConsole, type LogLevel } from "./console-sink.js";
import { sanitizeLogMetadata, type LogMetadata } from "./sanitize.js";

const levelOrder: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Production builds keep only warnings and errors with minimal context (LOGGING.md).
const minimumLevel: LogLevel = import.meta.env.PROD ? "warn" : "debug";

function log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
  if (levelOrder[level] < levelOrder[minimumLevel]) {
    return;
  }
  writeToConsole(level, message, sanitizeLogMetadata(metadata));
}

/** Feature code logs only through this facade and never passes API bodies or secrets. */
export const logger = Object.freeze({
  debug: (message: string, metadata?: LogMetadata) => log("debug", message, metadata),
  info: (message: string, metadata?: LogMetadata) => log("info", message, metadata),
  warn: (message: string, metadata?: LogMetadata) => log("warn", message, metadata),
  error: (message: string, metadata?: LogMetadata) => log("error", message, metadata),
});
