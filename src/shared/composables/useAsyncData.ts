import { ref, type Ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";

export type LoadState = "loading" | "ready" | "error";

/**
 * The loading/ready/error pattern every page needs (DESIGN.md: deliberate loading and error
 * states). `load` can be called again for "Try again" buttons and after mutations.
 */
export function useAsyncData<T>(fetch: () => Promise<T>, initial: T) {
  const data = ref(initial) as Ref<T>;
  const state = ref<LoadState>("loading");
  const error = ref("");

  async function load(): Promise<void> {
    state.value = "loading";
    try {
      data.value = await fetch();
      state.value = "ready";
    } catch (caught: unknown) {
      error.value = describeError(caught);
      state.value = "error";
    }
  }

  return { data, state, error, load };
}
