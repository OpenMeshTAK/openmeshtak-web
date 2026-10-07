import { reactive, readonly } from "vue";
import { ApiProblem } from "@/shared/errors/api-problem";

const state = reactive({ waiting: false, attempts: 0 });

/** Whether the app is waiting for Core to answer at all, e.g. while it starts after an update. */
export const coreConnection = readonly(state);

/**
 * Core is not reachable: the network request failed, the reverse proxy reports a missing
 * backend, or the development proxy answered without a problem document.
 */
function isUnreachable(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  return error instanceof ApiProblem && (error.status === 502 || error.status === 503 || error.status === 504 || (error.status === 500 && error.code === "UNKNOWN"));
}

/**
 * Runs `call` until Core answers, waiting a little longer after each failed attempt. Other
 * errors are passed on unchanged. Meanwhile `coreConnection.waiting` lets the app show a
 * connecting screen instead of an empty page.
 */
export async function untilCoreAnswers<T>(call: () => Promise<T>): Promise<T> {
  let delayMs = 1000;
  for (;;) {
    try {
      const result = await call();
      state.waiting = false;
      state.attempts = 0;
      return result;
    } catch (error: unknown) {
      if (!isUnreachable(error)) {
        state.waiting = false;
        throw error;
      }
      state.waiting = true;
      state.attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 10_000);
    }
  }
}
