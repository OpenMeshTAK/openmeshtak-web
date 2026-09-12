import { describeError, isApiProblem } from "@/shared/errors/api-problem";

/** Adds the reason behind Core's system-group protection to its safe problem detail. */
export function describeUserGroupError(caught: unknown): string {
  return isApiProblem(caught, "SYSTEM_GROUP_PROTECTED")
    ? `${caught.message} The Admin group always keeps every permission and at least one member.`
    : describeError(caught);
}
