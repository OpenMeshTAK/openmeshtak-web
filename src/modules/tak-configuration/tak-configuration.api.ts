import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";
import { ApiProblem } from "@/shared/errors/api-problem";

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

export type AtakPreferenceListDto = Schemas["AtakPreferenceListDto"];
export type AtakPreferenceEntryDto = Schemas["AtakPreferenceEntryDto"];
export type AtakPreferenceTargetDto = Schemas["AtakPreferenceTargetDto"];
export type AtakPreferenceCatalogDto = Schemas["AtakPreferenceCatalogDto"];
export type AtakCatalogKeyDto = Schemas["AtakCatalogKeyDto"];
export type AtakCatalogTopicDto = Schemas["AtakCatalogTopicDto"];
export type AtakScreenItemDto = Schemas["AtakScreenItemDto"];
export type ImportAtakPreferencesResponse = Schemas["ImportAtakPreferencesResponse"];

export function getAtakPreferences(eventId: string): Promise<AtakPreferenceListDto> {
  return unwrap(api.GET("/events/{eventId}/tak/atak-preferences", { params: { path: { eventId } } }));
}

export function replaceAtakPreferences(
  eventId: string,
  body: Schemas["ReplaceAtakPreferencesRequest"],
): Promise<AtakPreferenceListDto> {
  return unwrap(api.PUT("/events/{eventId}/tak/atak-preferences", { params: { path: { eventId } }, body }));
}

export function importAtakPreferences(
  eventId: string,
  body: Schemas["ImportAtakPreferencesRequest"],
): Promise<ImportAtakPreferencesResponse> {
  return unwrap(api.POST("/events/{eventId}/tak/atak-preferences/import", { params: { path: { eventId } }, body }));
}

export function getAtakPreferenceCatalog(): Promise<AtakPreferenceCatalogDto> {
  return unwrap(api.GET("/tak/atak-preference-catalog"));
}

/** The typed client parses JSON only, so the ZIP download uses fetch with the same-origin session. */
export async function downloadAtakUnlockPackage(eventId: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(
    new URL(`/api/v1/events/${encodeURIComponent(eventId)}/tak/atak-preferences/unlock-package`, window.location.origin).href,
    { credentials: "same-origin" },
  );
  if (!response.ok) {
    throw new ApiProblem(response.status, await response.json().catch(() => ({})));
  }
  const fileName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "atak-unlock.zip";
  return { blob: await response.blob(), fileName };
}
