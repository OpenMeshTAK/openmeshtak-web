/**
 * Accepts only same-application paths for post-login redirects. Absolute URLs and
 * protocol-relative paths such as `//evil.example` would turn the sign-in page into an open redirect.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : fallback;
}
