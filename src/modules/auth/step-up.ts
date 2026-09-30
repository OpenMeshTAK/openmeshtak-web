import { ref } from "vue";
import { useSession } from "./session";

/** One app-wide re-sign-in dialog; `StepUpHost` renders it. */
const open = ref(false);
let settle: ((confirmed: boolean) => void) | null = null;

/**
 * Opens the re-sign-in dialog and resolves `true` once the user has a fresh session, `false`
 * if they close it. Accounts without a password (opened with an access link) cannot step up,
 * so their callers keep showing their own explanation instead of a dialog that cannot help.
 */
export function requestStepUp(): Promise<boolean> {
  if (useSession().state.principal?.hasPassword === false) {
    return Promise.resolve(false);
  }
  settle?.(false);
  open.value = true;
  return new Promise((resolve) => {
    settle = resolve;
  });
}

function finish(confirmed: boolean): void {
  open.value = false;
  settle?.(confirmed);
  settle = null;
}

export function useStepUpDialog() {
  return { open, finish };
}
