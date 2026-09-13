import { authClient } from "@/modules/auth/auth-client";

export interface PasskeySummary {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
}

/** Thin wrapper around Better Auth's passkey endpoints so views see one small, typed surface. */
export async function listPasskeys(): Promise<PasskeySummary[]> {
  const result = await authClient.passkey.listUserPasskeys();
  if (result.error) {
    throw new Error("Your passkeys could not be loaded.");
  }
  return result.data.map(({ id, name, deviceType, backedUp, createdAt }) => ({
    id,
    name: name ?? null,
    deviceType,
    backedUp,
    createdAt: new Date(createdAt).toISOString(),
  }));
}

export type AddPasskeyResult =
  | { outcome: "added" }
  | { outcome: "sign-in-required" }
  /** Cancelled prompts, already registered authenticators and other WebAuthn failures. */
  | { outcome: "failed"; message: string };

/**
 * `accountName` becomes the WebAuthn user name that password managers show next to the passkey.
 * Better Auth asks for a recent sign-in first; the caller then offers step-up and retries.
 */
export async function addPasskey(accountName: string): Promise<AddPasskeyResult> {
  const result = await authClient.passkey.addPasskey({ name: accountName });
  if (!result.error) {
    return { outcome: "added" };
  }
  if ("code" in result.error && result.error.code === "SESSION_NOT_FRESH") {
    return { outcome: "sign-in-required" };
  }
  return { outcome: "failed", message: result.error.message ?? "The passkey could not be added." };
}

export async function deletePasskey(id: string): Promise<void> {
  const result = await authClient.passkey.deletePasskey({ id });
  if (result.error) {
    throw new Error("The passkey could not be removed.");
  }
}
