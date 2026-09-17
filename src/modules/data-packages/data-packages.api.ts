import { api, unwrap } from "@/shared/api/client";
import { ApiProblem } from "@/shared/errors/api-problem";
import type { Schemas } from "@/shared/api/types";

export type DataPackageDto = Schemas["DataPackageDto"];
export type PackageLayerDto = Schemas["PackageLayerDto"];
export type PackageObjectDto = Schemas["PackageObjectDto"];
export type PackageGeometry = Schemas["PackageGeometry"];
export type PackageObjectStyle = Schemas["PackageObjectStyle"];
export type ImportReport = Schemas["ImportReport"];
export type PublishResult = Schemas["PublishDataPackageResponse"];

type PackagePath = { eventId: string; packageId: string };

function pageQuery(cursor: string | undefined): { limit: number; cursor?: string } {
  return cursor === undefined ? { limit: 100 } : { limit: 100, cursor };
}

/** Collects every page of a cursor-paginated list; data package lists are bounded by Core. */
async function allPages<T>(fetchPage: (cursor?: string) => Promise<{ items: T[]; page: { nextCursor: string | null } }>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

export function listDataPackages(eventId: string): Promise<DataPackageDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/data-packages", { params: { path: { eventId }, query: pageQuery(cursor) } })),
  );
}

export function getDataPackage(path: PackagePath): Promise<DataPackageDto> {
  return unwrap(api.GET("/events/{eventId}/data-packages/{packageId}", { params: { path } }));
}

export function createDataPackage(eventId: string, body: Schemas["CreateDataPackageRequest"]): Promise<DataPackageDto> {
  return unwrap(api.POST("/events/{eventId}/data-packages", { params: { path: { eventId } }, body }));
}

export async function deleteDataPackage(path: PackagePath): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/data-packages/{packageId}", { params: { path } }));
}

export function listLayers(path: PackagePath): Promise<PackageLayerDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/data-packages/{packageId}/layers", { params: { path, query: pageQuery(cursor) } })),
  );
}

export function createLayer(path: PackagePath, name: string): Promise<PackageLayerDto> {
  return unwrap(api.POST("/events/{eventId}/data-packages/{packageId}/layers", { params: { path }, body: { name } }));
}

export function updateLayer(
  path: PackagePath,
  layerId: string,
  body: Schemas["UpdatePackageLayerRequest"],
): Promise<PackageLayerDto> {
  return unwrap(
    api.PUT("/events/{eventId}/data-packages/{packageId}/layers/{layerId}", { params: { path: { ...path, layerId } }, body }),
  );
}

export async function deleteLayer(path: PackagePath, layerId: string): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/data-packages/{packageId}/layers/{layerId}", { params: { path: { ...path, layerId } } }));
}

export function listObjects(path: PackagePath): Promise<PackageObjectDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/data-packages/{packageId}/objects", { params: { path, query: pageQuery(cursor) } })),
  );
}

export function createObject(path: PackagePath, body: Schemas["CreatePackageObjectRequest"]): Promise<PackageObjectDto> {
  return unwrap(api.POST("/events/{eventId}/data-packages/{packageId}/objects", { params: { path }, body }));
}

export function updateObject(
  path: PackagePath,
  objectId: string,
  body: Schemas["UpdatePackageObjectRequest"],
): Promise<PackageObjectDto> {
  return unwrap(
    api.PUT("/events/{eventId}/data-packages/{packageId}/objects/{objectId}", { params: { path: { ...path, objectId } }, body }),
  );
}

export async function deleteObject(path: PackagePath, objectId: string): Promise<void> {
  await unwrap(
    api.DELETE("/events/{eventId}/data-packages/{packageId}/objects/{objectId}", { params: { path: { ...path, objectId } } }),
  );
}

export function publishDataPackage(path: PackagePath): Promise<PublishResult> {
  return unwrap(api.POST("/events/{eventId}/data-packages/{packageId}/revisions", { params: { path } }));
}

export function importGeoJson(path: PackagePath, layerId: string, document: Schemas["GeoJsonDocument"]): Promise<ImportReport> {
  return unwrap(
    api.POST("/events/{eventId}/data-packages/{packageId}/layers/{layerId}/import", {
      params: { path: { ...path, layerId } },
      body: document,
    }),
  );
}

export function exportDraftGeoJson(path: PackagePath, layerId?: string): Promise<Schemas["GeoJsonFeatureCollection"]> {
  return unwrap(
    api.GET("/events/{eventId}/data-packages/{packageId}/geojson", {
      params: { path, query: layerId === undefined ? {} : { layerId } },
    }),
  );
}

function packageUrl(path: PackagePath, suffix: string): string {
  const base = `/api/v1/events/${encodeURIComponent(path.eventId)}/data-packages/${encodeURIComponent(path.packageId)}`;
  return new URL(`${base}/${suffix}`, window.location.origin).href;
}

async function failure(response: Response): Promise<ApiProblem> {
  return new ApiProblem(response.status, await response.json().catch(() => ({})));
}

/** ZIP archives start with "PK"; anything else is treated as a single CoT XML file. */
async function isZipFile(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b;
}

/**
 * Uploads an ATAK Data Package or CoT file as raw bytes. The typed client only sends JSON, so this
 * one call uses fetch directly; the same-origin session cookie authenticates it.
 */
export async function importAtak(path: PackagePath, layerId: string, file: File): Promise<ImportReport> {
  const response = await fetch(packageUrl(path, `layers/${encodeURIComponent(layerId)}/import/atak`), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": (await isZipFile(file)) ? "application/zip" : "application/xml" },
    body: file,
  });
  if (!response.ok) {
    throw await failure(response);
  }
  return (await response.json()) as ImportReport;
}

/** Downloads the ATAK Data Package of a published revision. */
export async function downloadAtak(
  path: PackagePath,
  revision: number,
  layerId?: string,
): Promise<{ blob: Blob; fileName: string }> {
  const query = layerId === undefined ? "" : `?layerId=${encodeURIComponent(layerId)}`;
  const response = await fetch(packageUrl(path, `revisions/${String(revision)}/atak${query}`), { credentials: "same-origin" });
  if (!response.ok) {
    throw await failure(response);
  }
  const fileName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "data-package.zip";
  return { blob: await response.blob(), fileName };
}
