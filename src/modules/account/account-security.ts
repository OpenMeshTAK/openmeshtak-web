import { authClient } from "@/modules/auth/auth-client";
import { api, unwrap } from "@/shared/api/client";

export interface SessionSummary {
  /** Better Auth identifies sessions by token; it stays inside this module and the sessions card. */
  token: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export type ChangePasswordResult =
  | { outcome: "changed" }
  | { outcome: "wrong-password" }
  | { outcome: "failed"; message: string };

/**
 * Changes the password and ends every other session, so a stolen session cannot outlive the
 * password it was opened with.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
  if (!result.error) {
    return { outcome: "changed" };
  }
  if ("code" in result.error && result.error.code === "INVALID_PASSWORD") {
    return { outcome: "wrong-password" };
  }
  return { outcome: "failed", message: result.error.message ?? "The password could not be changed." };
}

/** Sets the first password of an account that has none, e.g. after signing in with an access link. */
export async function setFirstPassword(newPassword: string): Promise<void> {
  await unwrap(api.POST("/me/password", { body: { newPassword } }));
}

export async function listSessions(): Promise<SessionSummary[]> {
  const [sessions, current] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
  if (sessions.error) {
    throw new Error("Your sessions could not be loaded.");
  }
  const currentToken = current.data?.session.token ?? null;
  return sessions.data
    .map((session) => ({
      token: session.token,
      current: session.token === currentToken,
      userAgent: session.userAgent ?? null,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt));
}

export async function endSession(token: string): Promise<void> {
  const result = await authClient.revokeSession({ token });
  if (result.error) {
    throw new Error("The session could not be ended.");
  }
}

export async function endOtherSessions(): Promise<void> {
  const result = await authClient.revokeOtherSessions();
  if (result.error) {
    throw new Error("The other sessions could not be ended.");
  }
}
