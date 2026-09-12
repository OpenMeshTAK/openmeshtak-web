import { ref } from "vue";
import { ApiProblem, describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";

/**
 * Tracks one form submission: busy flag, a general error message and Core's field-level errors.
 * `run` returns `{ value }` on success (so callers can close dialogs or navigate) and `null` after
 * a failure.
 */
export function useSubmission(describe: (error: unknown) => string = describeError) {
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const fields = ref<Record<string, string>>({});
  /** Core's problem code of the last failure, for flows that react to a specific problem. */
  const code = ref<string | null>(null);

  function reset(): void {
    error.value = null;
    fields.value = {};
    code.value = null;
  }

  async function run<T>(action: () => Promise<T>): Promise<{ value: T } | null> {
    submitting.value = true;
    reset();
    try {
      return { value: await action() };
    } catch (caught: unknown) {
      fields.value = fieldErrors(caught);
      code.value = caught instanceof ApiProblem ? caught.code : null;
      error.value = describe(caught);
      return null;
    } finally {
      submitting.value = false;
    }
  }

  return { submitting, error, fields, code, run, reset };
}
