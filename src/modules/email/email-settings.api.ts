import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type EmailSettingsDto = Schemas["EmailSettingsDto"];
export type EmailSettingsChanges = Omit<Schemas["UpdateEmailSettingsRequest"], "version">;

export function getEmailSettings(): Promise<EmailSettingsDto> {
  return unwrap(api.GET("/email/settings"));
}

/** Leave `password` out to keep the stored one; Core never returns it. */
export function saveEmailSettings(version: number, changes: EmailSettingsChanges): Promise<EmailSettingsDto> {
  return unwrap(api.PUT("/email/settings", { body: { version, ...changes } }));
}

export async function sendTestEmail(to: string): Promise<void> {
  await unwrap(api.POST("/email/settings/test", { body: { to } }));
}
