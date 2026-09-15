import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type MissionDto = Schemas["MissionDto"];
export type MissionLayerDto = Schemas["MissionLayerDto"];
export type MissionObjectDto = Schemas["MissionObjectDto"];
export type MissionGeometry = Schemas["MissionGeometry"];
export type MissionObjectStyle = Schemas["MissionObjectStyle"];
export type ImportReport = Schemas["GeoJsonImportReport"];
export type PublishResult = Schemas["PublishMissionResponse"];

type MissionPath = { eventId: string; missionId: string };

function pageQuery(cursor: string | undefined): { limit: number; cursor?: string } {
  return cursor === undefined ? { limit: 100 } : { limit: 100, cursor };
}

/** Collects every page of a cursor-paginated list; mission lists are bounded by Core. */
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

export function listMissions(eventId: string): Promise<MissionDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/missions", { params: { path: { eventId }, query: pageQuery(cursor) } })),
  );
}

export function getMission(path: MissionPath): Promise<MissionDto> {
  return unwrap(api.GET("/events/{eventId}/missions/{missionId}", { params: { path } }));
}

export function createMission(eventId: string, body: Schemas["CreateMissionRequest"]): Promise<MissionDto> {
  return unwrap(api.POST("/events/{eventId}/missions", { params: { path: { eventId } }, body }));
}

export async function deleteMission(path: MissionPath): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/missions/{missionId}", { params: { path } }));
}

export function listLayers(path: MissionPath): Promise<MissionLayerDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/missions/{missionId}/layers", { params: { path, query: pageQuery(cursor) } })),
  );
}

export function createLayer(path: MissionPath, name: string): Promise<MissionLayerDto> {
  return unwrap(api.POST("/events/{eventId}/missions/{missionId}/layers", { params: { path }, body: { name } }));
}

export function updateLayer(
  path: MissionPath,
  layerId: string,
  body: Schemas["UpdateMissionLayerRequest"],
): Promise<MissionLayerDto> {
  return unwrap(
    api.PUT("/events/{eventId}/missions/{missionId}/layers/{layerId}", { params: { path: { ...path, layerId } }, body }),
  );
}

export async function deleteLayer(path: MissionPath, layerId: string): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/missions/{missionId}/layers/{layerId}", { params: { path: { ...path, layerId } } }));
}

export function listObjects(path: MissionPath): Promise<MissionObjectDto[]> {
  return allPages((cursor) =>
    unwrap(api.GET("/events/{eventId}/missions/{missionId}/objects", { params: { path, query: pageQuery(cursor) } })),
  );
}

export function createObject(path: MissionPath, body: Schemas["CreateMissionObjectRequest"]): Promise<MissionObjectDto> {
  return unwrap(api.POST("/events/{eventId}/missions/{missionId}/objects", { params: { path }, body }));
}

export function updateObject(
  path: MissionPath,
  objectId: string,
  body: Schemas["UpdateMissionObjectRequest"],
): Promise<MissionObjectDto> {
  return unwrap(
    api.PUT("/events/{eventId}/missions/{missionId}/objects/{objectId}", { params: { path: { ...path, objectId } }, body }),
  );
}

export async function deleteObject(path: MissionPath, objectId: string): Promise<void> {
  await unwrap(
    api.DELETE("/events/{eventId}/missions/{missionId}/objects/{objectId}", { params: { path: { ...path, objectId } } }),
  );
}

export function publishMission(path: MissionPath): Promise<PublishResult> {
  return unwrap(api.POST("/events/{eventId}/missions/{missionId}/revisions", { params: { path } }));
}

export function importGeoJson(path: MissionPath, layerId: string, document: Schemas["GeoJsonDocument"]): Promise<ImportReport> {
  return unwrap(
    api.POST("/events/{eventId}/missions/{missionId}/layers/{layerId}/import", {
      params: { path: { ...path, layerId } },
      body: document,
    }),
  );
}

export function exportDraftGeoJson(path: MissionPath): Promise<Schemas["GeoJsonFeatureCollection"]> {
  return unwrap(api.GET("/events/{eventId}/missions/{missionId}/geojson", { params: { path } }));
}
