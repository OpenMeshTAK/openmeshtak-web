import { createAuthClient } from "better-auth/vue";

/**
 * Better Auth owns credentials and sessions. Its endpoints live under `/api/auth` on the same
 * origin, so the HttpOnly session cookie never becomes visible to JavaScript.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: { credentials: "same-origin" },
});
