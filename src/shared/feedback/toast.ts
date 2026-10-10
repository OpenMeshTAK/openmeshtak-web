import { ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";

export type ToastKind = "success" | "info" | "warning" | "error";

export interface ToastMessage {
  text: string;
  /** Shown as a small colored icon; the toast itself stays neutral so it reads calmly. */
  kind: ToastKind;
  /** Milliseconds; `-1` keeps the toast open until it is dismissed. */
  timeout: number;
  /** Optional button next to "Dismiss", e.g. "Reload". */
  action?: { label: string; run: () => void };
}

const SHORT_TIMEOUT_MS = 4000;
const LONG_TIMEOUT_MS = 8000;

/** Single queue for the whole app; `ToastHost` renders it. */
const queue = ref<ToastMessage[]>([]);

function push(kind: ToastKind, text: string, timeout: number, action?: ToastMessage["action"]): void {
  queue.value = [...queue.value, { text, kind, timeout, ...(action === undefined ? {} : { action }) }];
}

export function useToast() {
  return {
    success: (text: string) => push("success", text, SHORT_TIMEOUT_MS),
    info: (text: string) => push("info", text, SHORT_TIMEOUT_MS),
    warning: (text: string) => push("warning", text, LONG_TIMEOUT_MS),
    /** Accepts a message or a caught error; errors stay until the user dismisses them. */
    error: (failure: unknown) => push("error", typeof failure === "string" ? failure : describeError(failure), -1),
    /** Stays until dismissed or until the user takes the action, e.g. reloading for a new version. */
    lasting: (kind: ToastKind, text: string, action: NonNullable<ToastMessage["action"]>) => push(kind, text, -1, action),
  };
}

export function useToastQueue() {
  return queue;
}
