import { ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";

export type ToastKind = "success" | "info" | "warning" | "error";

export interface ToastMessage {
  text: string;
  color: ToastKind;
  /** Milliseconds; `-1` keeps the toast open until it is dismissed. */
  timeout: number;
}

const SHORT_TIMEOUT_MS = 4000;
const LONG_TIMEOUT_MS = 8000;

/** Single queue for the whole app; `ToastHost` renders it. See DESIGN.md, "Action feedback". */
const queue = ref<ToastMessage[]>([]);

function push(color: ToastKind, text: string, timeout: number): void {
  queue.value = [...queue.value, { text, color, timeout }];
}

export function useToast() {
  return {
    success: (text: string) => push("success", text, SHORT_TIMEOUT_MS),
    info: (text: string) => push("info", text, SHORT_TIMEOUT_MS),
    warning: (text: string) => push("warning", text, LONG_TIMEOUT_MS),
    /** Accepts a message or a caught error; errors stay until the user dismisses them. */
    error: (failure: unknown) => push("error", typeof failure === "string" ? failure : describeError(failure), -1),
  };
}

export function useToastQueue() {
  return queue;
}
