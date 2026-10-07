import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type RegistrationMode = Schemas["RegistrationMode"];
export type RegistrationSettingsDto = Schemas["RegistrationSettingsDto"];
export type RegistrationInviteDto = Schemas["RegistrationInviteDto"];

/** Public: whether the sign-in page offers "Create account". */
export async function fetchRegistrationMode(): Promise<RegistrationMode> {
  return (await unwrap(api.GET("/registration"))).mode;
}

/** Creates the account and signs it in; Core sets the session cookie. */
export function register(body: Schemas["RegisterRequest"]): Promise<Schemas["RegisterResponse"]> {
  return unwrap(api.POST("/registration", { body }));
}

export function loadRegistrationSettings(): Promise<RegistrationSettingsDto> {
  return unwrap(api.GET("/registration-settings"));
}

export function saveRegistrationSettings(version: number, mode: RegistrationMode): Promise<RegistrationSettingsDto> {
  return unwrap(api.PUT("/registration-settings", { body: { version, mode } }));
}

export function listRegistrationInvites(): Promise<RegistrationInviteDto[]> {
  return unwrap(api.GET("/registration-invites"));
}

export function createRegistrationInvite(): Promise<Schemas["CreatedRegistrationInviteResponse"]> {
  return unwrap(api.POST("/registration-invites"));
}

export function revokeRegistrationInvite(inviteId: string): Promise<RegistrationInviteDto> {
  return unwrap(api.POST("/registration-invites/{inviteId}/revoke", { params: { path: { inviteId } } }));
}

/** Setup links of administrator-created users: exchanged once for a session in a request body. */
export async function exchangeSetupLink(token: string): Promise<void> {
  await unwrap(api.POST("/auth/setup-links/exchange", { body: { token } }));
}
