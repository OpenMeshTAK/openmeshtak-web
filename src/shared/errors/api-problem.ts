export interface ProblemFieldError {
  field: string;
  code: string;
  message: string;
}

interface ProblemBody {
  type?: unknown;
  title?: unknown;
  status?: unknown;
  detail?: unknown;
  code?: unknown;
  traceId?: unknown;
  errors?: unknown;
  currentVersion?: unknown;
}

/**
 * An RFC 9457 problem returned by Core. Views branch on `status` and `code`, never on the
 * human-readable text, and show `detail` because Core guarantees it is safe to display.
 */
export class ApiProblem extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly traceId: string | undefined;
  public readonly errors: ProblemFieldError[];
  public readonly currentVersion: number | undefined;

  public constructor(status: number, body: unknown) {
    const problem = (typeof body === "object" && body !== null ? body : {}) as ProblemBody;
    super(typeof problem.detail === "string" ? problem.detail : "The request could not be completed.");
    this.name = "ApiProblem";
    this.status = status;
    this.code = typeof problem.code === "string" ? problem.code : "UNKNOWN";
    this.traceId = typeof problem.traceId === "string" ? problem.traceId : undefined;
    this.errors = Array.isArray(problem.errors) ? (problem.errors as ProblemFieldError[]) : [];
    this.currentVersion =
      typeof problem.currentVersion === "number" ? problem.currentVersion : undefined;
  }
}

export function isApiProblem(error: unknown, code?: string): error is ApiProblem {
  return error instanceof ApiProblem && (code === undefined || error.code === code);
}

/** Field messages longer than this are schema diagnostics, not text for people. */
const READABLE_FIELD_MESSAGE_LENGTH = 160;

/**
 * Message for a generic error state; network failures are not problems and get their own text.
 * Validation problems add their first readable field message, e.g. why a geometry was rejected.
 */
export function describeError(error: unknown): string {
  if (error instanceof ApiProblem) {
    const field = error.errors.find(({ message }) => message.length <= READABLE_FIELD_MESSAGE_LENGTH);
    return error.code === "VALIDATION_FAILED" && field !== undefined ? `${error.message} ${field.message}` : error.message;
  }
  return "OpenMeshTak is not reachable. Check your connection and try again.";
}
