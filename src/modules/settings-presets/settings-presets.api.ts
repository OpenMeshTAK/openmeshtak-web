import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type PresetKind = Schemas["PresetKind"];
export type PresetDocumentDto = Schemas["PresetDocumentDto"];
export type MeshtasticPresetPreviewDto = Schemas["MeshtasticPresetPreviewDto"];
export type TakPresetPreviewDto = Schemas["TakPresetPreviewDto"];
export type PresetTargetMappingDto = Schemas["PresetTargetMappingDto"];
export type SettingsPresetSummaryDto = Schemas["SettingsPresetSummaryDto"];
export type SettingsPresetDto = Schemas["SettingsPresetDto"];

/** The event's settings of one kind as a portable preset document. */
export function exportPreset(eventId: string, kind: PresetKind): Promise<PresetDocumentDto> {
  const params = { params: { path: { eventId } } };
  return kind === "meshtastic"
    ? unwrap(api.GET("/events/{eventId}/meshtastic/preset", params))
    : unwrap(api.GET("/events/{eventId}/tak/preset", params));
}

export function previewMeshtasticPreset(eventId: string, document: PresetDocumentDto): Promise<MeshtasticPresetPreviewDto> {
  return unwrap(api.POST("/events/{eventId}/meshtastic/preset/preview", { params: { path: { eventId } }, body: { document } }));
}

export function importMeshtasticPreset(eventId: string, body: Schemas["ApplyMeshtasticPresetRequest"]): Promise<unknown> {
  return unwrap(api.POST("/events/{eventId}/meshtastic/preset/import", { params: { path: { eventId } }, body }));
}

export function previewTakPreset(eventId: string, document: PresetDocumentDto, mappings: PresetTargetMappingDto[]): Promise<TakPresetPreviewDto> {
  return unwrap(api.POST("/events/{eventId}/tak/preset/preview", { params: { path: { eventId } }, body: { document, mappings } }));
}

export function importTakPreset(eventId: string, body: Schemas["ApplyTakPresetRequest"]): Promise<unknown> {
  return unwrap(api.POST("/events/{eventId}/tak/preset/import", { params: { path: { eventId } }, body }));
}

/** Every library preset of a kind, or all; the library is small, so all pages are loaded. */
export async function listPresets(kind?: PresetKind): Promise<SettingsPresetSummaryDto[]> {
  const items: SettingsPresetSummaryDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      api.GET("/presets", { params: { query: { limit: 100, ...(kind === undefined ? {} : { kind }), ...(cursor === undefined ? {} : { cursor }) } } }),
    );
    items.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

export function getPreset(presetId: string): Promise<SettingsPresetDto> {
  return unwrap(api.GET("/presets/{presetId}", { params: { path: { presetId } } }));
}

export function createPreset(body: Schemas["CreateSettingsPresetRequest"]): Promise<SettingsPresetDto> {
  return unwrap(api.POST("/presets", { body }));
}

export function updatePreset(presetId: string, body: Schemas["UpdateSettingsPresetRequest"]): Promise<SettingsPresetDto> {
  return unwrap(api.PUT("/presets/{presetId}", { params: { path: { presetId } }, body }));
}

export async function deletePreset(presetId: string): Promise<void> {
  await unwrap(api.DELETE("/presets/{presetId}", { params: { path: { presetId } } }));
}
