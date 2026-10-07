import { authClient } from "./auth-client";

/** Access-link accounts carry Core's internal placeholder address, which is not a real inbox. */
export const PLACEHOLDER_EMAIL_DOMAIN = "@participants.openmeshtak.invalid";

export function isRealEmail(email: string | null | undefined): email is string {
  return typeof email === "string" && email !== "" && !email.endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/** The signed-in account's email address, or `null` when it has none or only the placeholder. */
export async function currentAccountEmail(): Promise<string | null> {
  const session = await authClient.getSession();
  const email = session.data?.user.email;
  return isRealEmail(email) ? email : null;
}
