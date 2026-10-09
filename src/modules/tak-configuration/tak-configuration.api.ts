import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type TakConfigurationDto = Schemas["TakConfigurationDto"];

export function getTakConfiguration(eventId: string): Promise<TakConfigurationDto> {
  return unwrap(api.GET("/events/{eventId}/tak/configuration", { params: { path: { eventId } } }));
}

export function updateTakConfiguration(
  eventId: string,
  body: Schemas["UpdateTakConfigurationRequest"],
): Promise<TakConfigurationDto> {
  return unwrap(api.PUT("/events/{eventId}/tak/configuration", { params: { path: { eventId } }, body }));
}

export type AtakSettingsDto = Schemas["AtakSettingsDto"];

export function updateAtakPreferenceFile(
  eventId: string,
  body: Schemas["UpdateAtakPreferenceFileRequest"],
): Promise<Schemas["UpdateAtakPreferenceFileResponse"]> {
  return unwrap(api.PUT("/events/{eventId}/tak/configuration/atak-preferences", { params: { path: { eventId } }, body }));
}
