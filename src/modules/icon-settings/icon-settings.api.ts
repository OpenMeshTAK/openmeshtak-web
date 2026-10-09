import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";
import { ApiProblem } from "@/shared/errors/api-problem";

export type IconSettings = Schemas["IconSettingsDto"];
export type IconCatalogue = Schemas["InstanceIconCatalogue"];
export type IconSettingsResult = Schemas["UpdateIconSettingsResult"];

let catalogue: Promise<IconCatalogue> | null = null;
export function getIconSettings(): Promise<IconSettings> {
  return unwrap(api.GET("/map/icons/settings"));
}
/** Shared by map views and pickers until a settings change or page reload. */
export function loadInstanceIcons(): Promise<IconCatalogue> {
  catalogue ??= unwrap(api.GET("/map/icons")).catch((error: unknown) => { catalogue = null; throw error; });
  return catalogue;
}
export function instanceIconUrl(version: number, iconId: string): string {
  return `/api/v1/map/icons/${version}/${encodeURIComponent(iconId)}/image`;
}
export async function uploadInstanceIcons(version: number, file: File): Promise<IconSettingsResult> {
  const response = await fetch(`/api/v1/map/icons/settings?version=${version}`, {
    method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/octet-stream" }, body: file,
  });
  if (!response.ok) throw new ApiProblem(response.status, await response.json().catch(() => ({})));
  catalogue = null;
  return await response.json() as IconSettingsResult;
}
export async function removeInstanceIcons(version: number): Promise<IconSettings> {
  const result = await unwrap(api.DELETE("/map/icons/settings", { params: { query: { version } } }));
  catalogue = null;
  return result;
}
