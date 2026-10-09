import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type MapSettingsDto = Schemas["MapSettingsDto"];
export type BaseMapLayer = Schemas["BaseMapLayerDto"];
export type MapSettingsChanges = Omit<Schemas["UpdateMapSettingsRequest"], "version">;

/** OpenStreetMap, the same default Core uses, for when the settings cannot be loaded. */
const defaultLayer: BaseMapLayer = {
  id: "00000000-0000-4000-8000-000000000001",
  providerName: "OpenStreetMap",
  tileUrlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
};
export const FALLBACK_BASE_MAP: MapSettingsDto = { ...defaultLayer, version: 0, layers: [defaultLayer], defaultLayerId: defaultLayer.id };

let cached: Promise<MapSettingsDto> | null = null;

/** Settings forms show a loading failure instead of editing the fallback provider. */
export function getMapSettings(): Promise<MapSettingsDto> {
  return unwrap(api.GET("/map/settings"));
}

/** Loaded once per page load; every map on the page shares it. */
export function loadBaseMap(): Promise<MapSettingsDto> {
  cached ??= getMapSettings().catch(() => FALLBACK_BASE_MAP);
  return cached;
}

export async function saveMapSettings(version: number, changes: MapSettingsChanges): Promise<MapSettingsDto> {
  const saved = await unwrap(api.PUT("/map/settings", { body: { version, ...changes } }));
  cached = Promise.resolve(saved);
  return saved;
}
