const REDACTED = "[REDACTED]";

const sensitiveKeyPattern =
  /(?:authorization|cookie|api-?key|password|credential|secret|token|session|csrf|psk|private-?key|claim|qr)/i;
const openMeshTakSecretPattern = /omtk_(?:ak_[A-Za-z0-9_-]+_|bootstrap_|claim_)[A-Za-z0-9_-]+/g;

export type LogMetadata = Record<string, unknown>;

function sanitizeString(value: string): string {
  return value.replace(openMeshTakSecretPattern, REDACTED);
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);

  if (value instanceof Error) {
    return { name: value.name, message: sanitizeString(value.message) };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKeyPattern.test(key) ? REDACTED : sanitizeValue(nested, seen),
    ]),
  );
}

/**
 * Browser counterpart of Core's sanitizer. Server-side Pino redaction does not protect browser
 * output, so every Web log event passes through here first.
 */
export function sanitizeLogMetadata(metadata: LogMetadata): LogMetadata {
  try {
    return sanitizeValue(metadata, new WeakSet()) as LogMetadata;
  } catch {
    return { event: "log_sanitization_failed" };
  }
}
