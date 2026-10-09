import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";
import { ApiProblem } from "@/shared/errors/api-problem";
import type { PackageContentDto } from "@/modules/data-packages/data-packages.api";

export type PackageIcon = Schemas["PackageIconDto"];
export type IconImportResult = Schemas["IconLibraryImportResult"];
export interface IconLibraryRef { eventId: string; packageId: string; contentId: string }
export type PackagePath = { eventId: string; packageId: string };

export function iconLibraries(path: PackagePath, contents: readonly PackageContentDto[]): IconLibraryRef[] {
  return contents.filter((content) => content.kind === "icon-library" && content.visible).map(({ id }) => ({ ...path, contentId: id }));
}

export function listLibraryIcons(path: IconLibraryRef): Promise<PackageIcon[]> {
  return unwrap(api.GET("/events/{eventId}/data-packages/{packageId}/contents/{contentId}/icons", { params: { path } }));
}

export function iconImageUrl(path: IconLibraryRef, iconId: string): string {
  return `/api/v1/events/${encodeURIComponent(path.eventId)}/data-packages/${encodeURIComponent(path.packageId)}/contents/${encodeURIComponent(path.contentId)}/icons/${encodeURIComponent(iconId)}/image`;
}

export async function uploadIconDatabase(path: PackagePath, layerId: string, file: File): Promise<IconImportResult> {
  const response = await fetch(`/api/v1/events/${encodeURIComponent(path.eventId)}/data-packages/${encodeURIComponent(path.packageId)}/layers/${encodeURIComponent(layerId)}/import/icons`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/octet-stream" }, body: file,
  });
  if (!response.ok) throw new ApiProblem(response.status, await response.json().catch(() => ({})));
  return await response.json() as IconImportResult;
}
