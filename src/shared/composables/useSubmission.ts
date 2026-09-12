import { ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";

/**
 * Tracks one form submission: busy flag, a general error message and Core's field-level errors.
 * `run` returns `true` on success so callers can close dialogs or navigate.
 */
export function useSubmission(describe: (error: unknown) => string = describeError) {
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const fields = ref<Record<string, string>>({});

  function reset(): void {
    error.value = null;
    fields.value = {};
  }

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    submitting.value = true;
    reset();
    try {
      await action();
      return true;
    } catch (caught: unknown) {
      fields.value = fieldErrors(caught);
      error.value = describe(caught);
      return false;
    } finally {
      submitting.value = false;
    }
  }

  return { submitting, error, fields, run, reset };
}
