import type { Middleware } from "openapi-fetch";

/** Asks the user to sign in again; resolves `true` once a fresh session exists. */
export type StepUpHandler = () => Promise<boolean>;

const RECENT_AUTHENTICATION_REQUIRED = "RECENT_AUTHENTICATION_REQUIRED";

let handler: StepUpHandler | null = null;
/** Concurrent sensitive requests share one dialog instead of stacking several. */
let pending: Promise<boolean> | null = null;
/** A request body can only be read once, so keep an untouched copy for the retry. */
const retryCopies = new WeakMap<Request, Request>();

/** The auth module registers the dialog here; shared code never imports feature modules. */
export function setStepUpHandler(next: StepUpHandler | null): void {
  handler = next;
}

async function asksForRecentSignIn(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return body.code === RECENT_AUTHENTICATION_REQUIRED;
  } catch {
    return false;
  }
}

function confirmIdentity(current: StepUpHandler): Promise<boolean> {
  pending ??= current().finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * Core answers sensitive actions with `RECENT_AUTHENTICATION_REQUIRED` when the session is
 * older than its step-up window. Instead of surfacing that as an error, open the sign-in
 * dialog and repeat the request once. If the user cancels, the original problem is returned
 * so the caller shows its normal error.
 */
export const stepUpMiddleware: Middleware = {
  onRequest({ request }) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      retryCopies.set(request, request.clone());
    }
  },
  async onResponse({ request, response }) {
    const copy = retryCopies.get(request);
    retryCopies.delete(request);
    if (handler === null || copy === undefined || !(await asksForRecentSignIn(response))) {
      return undefined;
    }
    const confirmed = await confirmIdentity(handler);
    return confirmed ? globalThis.fetch(copy) : undefined;
  },
};
