import { api, unwrap } from "@/shared/api/client";
import { ApiProblem } from "@/shared/errors/api-problem";
import type { Schemas } from "@/shared/api/types";

export type DataPackageDto = Schemas["DataPackageDto"];
export type PackageLayerDto = Schemas["PackageLayerDto"];
export type PackageObjectDto = Schemas["PackageObjectDto"];
export type PackageGeometry = Schemas["PackageGeometry"];
export type PackageObjectStyle = Schemas["PackageObjectStyle"];
export type TakMarker = Schemas["TakMarker"];
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

export type DataPackageKind = Schemas["DataPackageKind"];

/** Data packages and missions are listed separately; callers that do not say get Data Packages. */
export function listDataPackages(eventId: string, kind: DataPackageKind = "package"): Promise<DataPackageDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/data-packages", { params: { path: { eventId }, query: { ...pageQuery(cursor), kind } } })),
  );
}

export function updateMissionWriters(path: PackagePath, version: number, writers: Schemas["EventAudience"]): Promise<DataPackageDto> {
  return unwrap(api.PUT("/events/{eventId}/data-packages/{packageId}/writers", { params: { path }, body: { version, writers } }));
}

export function getDataPackage(path: PackagePath): Promise<DataPackageDto> {
  return unwrap(api.GET("/events/{eventId}/data-packages/{packageId}", { params: { path } }));
}

export function createDataPackage(eventId: string, body: Schemas["CreateDataPackageRequest"]): Promise<DataPackageDto> {
  return unwrap(api.POST("/events/{eventId}/data-packages", { params: { path: { eventId } }, body }));
}

export type PackageAudience = Schemas["PackageAudience"];

export function updatePackageAudience(
  path: PackagePath,
  version: number,
  audience: PackageAudience,
): Promise<DataPackageDto> {
  return unwrap(
    api.PUT("/events/{eventId}/data-packages/{packageId}/audience", {
      params: { path },
      body: { version, audience },
    }),
  );
}

export type PackageTakDelivery = Schemas["PackageTakDelivery"];

export function updatePackageTakDelivery(
  path: PackagePath,
  version: number,
  takDelivery: PackageTakDelivery,
): Promise<DataPackageDto> {
  return unwrap(
    api.PUT("/events/{eventId}/data-packages/{packageId}/tak-delivery", {
      params: { path },
      body: { version, takDelivery },
    }),
  );
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

export function getObject(path: PackagePath, objectId: string): Promise<PackageObjectDto> {
  return unwrap(api.GET("/events/{eventId}/data-packages/{packageId}/objects/{objectId}", { params: { path: { ...path, objectId } } }));
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

export type CombinedExportRequest = Schemas["CombinedExportRequest"];
export type CombinedExportReport = Schemas["CombinedExportReport"];
export type CombinedExportSelection = Schemas["CombinedExportSelection"];

export function previewCombinedExport(eventId: string, body: CombinedExportRequest): Promise<CombinedExportReport> {
  return unwrap(api.POST("/events/{eventId}/data-package-exports/atak/preview", { params: { path: { eventId } }, body }));
}

/** Copies published packages or layers into a new editable package with new object UUIDs. */
export function createDataPackageCopy(
  eventId: string,
  body: Schemas["CreateDataPackageCopyRequest"],
): Promise<DataPackageDto> {
  return unwrap(api.POST("/events/{eventId}/data-package-copies", { params: { path: { eventId } }, body }));
}

/** The typed client parses JSON only, so the ZIP download uses fetch with the same-origin session. */
export async function downloadCombinedExport(
  eventId: string,
  body: CombinedExportRequest,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(
    new URL(`/api/v1/events/${encodeURIComponent(eventId)}/data-package-exports/atak`, window.location.origin).href,
    { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!response.ok) {
    throw await failure(response);
  }
  const fileName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "data-packages.zip";
  return { blob: await response.blob(), fileName };
}

export type ImportedDataPackage = Schemas["ImportedDataPackage"];

/** Creates a new data package from an ATAK Data Package or CoT file; Core names it after the manifest. */
export async function importAsNewPackage(eventId: string, file: File): Promise<ImportedDataPackage> {
  const url = new URL(`/api/v1/events/${encodeURIComponent(eventId)}/data-package-imports/atak`, window.location.origin);
  url.searchParams.set("fileName", file.name);
  const response = await fetch(url.href, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": (await isZipFile(file)) ? "application/zip" : "application/xml" },
    body: file,
  });
  if (!response.ok) {
    throw await failure(response);
  }
  return (await response.json()) as ImportedDataPackage;
}

export type PackageContentDto = Schemas["PackageContentDto"];

export function listContents(path: PackagePath): Promise<PackageContentDto[]> {
  return unwrap(api.GET("/events/{eventId}/data-packages/{packageId}/contents", { params: { path } }));
}

/** Same-origin URLs, so the browser sends the session cookie with every tile and image request. */
export function contentTileUrl(path: PackagePath, contentId: string): string {
  return `${packageUrl(path, `contents/${encodeURIComponent(contentId)}/tiles`)}/{z}/{x}/{y}`;
}

export function contentImageUrl(path: PackagePath, contentId: string): string {
  return packageUrl(path, `contents/${encodeURIComponent(contentId)}/image`);
}

/** Replaces the drawing order of all packages of an event; IDs bottom first. */
export function reorderDataPackages(eventId: string, packageIds: string[], kind: DataPackageKind = "package"): Promise<DataPackageDto[]> {
  return unwrap(api.PUT("/events/{eventId}/data-package-order", { params: { path: { eventId } }, body: { packageIds, kind } }));
}

export type ContentChanges = Partial<Pick<PackageContentDto, "name" | "layerId" | "visible" | "opacity">>;

export function updateContent(path: PackagePath, content: PackageContentDto, changes: ContentChanges): Promise<PackageContentDto> {
  return unwrap(
    api.PUT("/events/{eventId}/data-packages/{packageId}/contents/{contentId}", {
      params: { path: { ...path, contentId: content.id } },
      body: {
        version: content.version,
        name: changes.name ?? content.name,
        layerId: changes.layerId ?? content.layerId,
        visible: changes.visible ?? content.visible,
        opacity: changes.opacity ?? content.opacity,
      },
    }),
  );
}

export async function deleteContent(path: PackagePath, contentId: string): Promise<void> {
  await unwrap(
    api.DELETE("/events/{eventId}/data-packages/{packageId}/contents/{contentId}", {
      params: { path: { ...path, contentId } },
    }),
  );
}

/** The draft as KML for GIS tools, optionally one layer; Core names the file. */
export async function downloadDraftKml(path: PackagePath, layerId?: string): Promise<{ blob: Blob; fileName: string }> {
  const url = new URL(packageUrl(path, "kml"));
  if (layerId !== undefined) {
    url.searchParams.set("layerId", layerId);
  }
  const response = await fetch(url.href, { credentials: "same-origin" });
  if (!response.ok) {
    throw await failure(response);
  }
  const fileName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "data-package.kml";
  return { blob: await response.blob(), fileName };
}
