import { reactive, readonly } from "vue";
import { api, unwrap } from "@/shared/api/client";
import type { Permission, Schemas } from "@/shared/api/types";
import { isApiProblem } from "@/shared/errors/api-problem";
import { authClient } from "./auth-client";

type SessionStatus = "unknown" | "anonymous" | "authenticated";

const state = reactive<{ status: SessionStatus; principal: Schemas["PrincipalDto"] | null }>({
  status: "unknown",
  principal: null,
});

let loading: Promise<void> | null = null;

/** Asks Core who the session belongs to. A 401 simply means nobody is signed in. */
async function refresh(): Promise<void> {
  try {
    state.principal = await unwrap(api.GET("/principal"));
    state.status = "authenticated";
  } catch (error: unknown) {
    if (!isApiProblem(error) || error.status !== 401) {
      throw error;
    }
    state.principal = null;
    state.status = "anonymous";
  }
}

async function ensureLoaded(): Promise<void> {
  if (state.status !== "unknown") {
    return;
  }
  loading ??= refresh().finally(() => {
    loading = null;
  });
  await loading;
}

/**
 * UI hint only. An event ID checks that event, null checks instance-wide grants, and omitting
 * the scope checks for a grant on any event (e.g. the Events navigation entry). Core still
 * authorizes every request, so this never replaces a server check.
 */
function can(permission: Permission, eventId?: string | null): boolean {
  return (state.principal?.permissions ?? []).some(
    (grant) =>
      grant.permission === permission &&
      (grant.eventId === null || eventId === undefined || grant.eventId === eventId),
  );
}

async function signOut(): Promise<void> {
  await authClient.signOut();
  state.principal = null;
  state.status = "anonymous";
}

export function useSession() {
  return { state: readonly(state), refresh, ensureLoaded, can, signOut };
}
