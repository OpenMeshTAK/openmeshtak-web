import { ApiProblem } from "./api-problem";

/** Maps Core's field-level validation problems onto form fields (`body.email` -> `email`). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiProblem)) {
    return {};
  }
  return Object.fromEntries(
    error.errors.map(({ field, message }) => [field.replace(/^(?:body|requestBody)\./, ""), message]),
  );
}

/** Error messages for one form field in the shape Vuetify inputs expect. */
export function messagesFor(errors: Record<string, string>, field: string): string[] {
  const message = errors[field];
  return message === undefined ? [] : [message];
}
