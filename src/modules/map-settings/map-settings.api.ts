import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type MapSettingsDto = Schemas["MapSettingsDto"];
export type MapSettingsChanges = Omit<Schemas["UpdateMapSettingsRequest"], "version">;

/** OpenStreetMap, the same default Core uses, for when the settings cannot be loaded. */
export const FALLBACK_BASE_MAP: MapSettingsDto = {
  providerName: "OpenStreetMap",
  tileUrlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
  version: 0,
};

let cached: Promise<MapSettingsDto> | null = null;

/** Loaded once per page load; every map on the page shares it. */
export function loadBaseMap(): Promise<MapSettingsDto> {
  cached ??= unwrap(api.GET("/map/settings")).catch(() => FALLBACK_BASE_MAP);
  return cached;
}

export async function saveMapSettings(version: number, changes: MapSettingsChanges): Promise<MapSettingsDto> {
  const saved = await unwrap(api.PUT("/map/settings", { body: { version, ...changes } }));
  cached = Promise.resolve(saved);
  return saved;
}
