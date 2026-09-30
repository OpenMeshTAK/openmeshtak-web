/**
 * Usernames sign in to OpenMeshTak and log in to TAK apps, so people type them on phones. Core
 * enforces the same rule; this copy only gives early feedback in forms.
 */
const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export const USERNAME_HINT = "3–32 lowercase letters, digits, dots, underscores or hyphens. Used to sign in and in TAK apps.";

export function usernameRule(value: string): true | string {
  return USERNAME_PATTERN.test(value) || "Use 3–32 lowercase letters, digits, dots, underscores or hyphens.";
}

/** Typing "Peter" yields "peter": usernames are lowercase. */
export function normalizeUsernameInput(value: string): string {
  return value.trim().toLowerCase();
}
