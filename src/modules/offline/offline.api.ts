import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type OfflineSnapshotDto = Schemas["OfflineSnapshotDto"];
export type OfflineSnapshotPackage = Schemas["OfflineSnapshotPackageDto"];
export type OfflineContent = Schemas["OfflineContentDto"];
export type OfflineTilePage = Schemas["OfflineTilePage"];

/** Revision content addressed by the offline endpoints. */
export interface OfflineContentPath {
  eventId: string;
  packageId: string;
  revision: number;
  contentId: string;
}

/** Asks Core for the snapshot document of the selected published packages. Audited by Core. */
export function createOfflineSnapshot(eventId: string, packageIds: string[]): Promise<OfflineSnapshotDto> {
  return unwrap(
    api.POST("/events/{eventId}/offline-snapshots", {
      params: { path: { eventId } },
      body: { packages: packageIds.map((packageId) => ({ packageId })) },
    }),
  );
}

export function listOfflineTiles(path: OfflineContentPath, cursor: string | undefined): Promise<OfflineTilePage> {
  return unwrap(
    api.GET("/events/{eventId}/offline-snapshots/packages/{packageId}/revisions/{number}/contents/{contentId}/tiles", {
      params: {
        path: { eventId: path.eventId, packageId: path.packageId, number: path.revision, contentId: path.contentId },
        query: { limit: 100, ...(cursor === undefined ? {} : { cursor }) },
      },
    }),
  );
}

export async function downloadOfflineImage(path: OfflineContentPath): Promise<Blob> {
  const data = await unwrap(
    api.GET("/events/{eventId}/offline-snapshots/packages/{packageId}/revisions/{number}/contents/{contentId}/image", {
      params: { path: { eventId: path.eventId, packageId: path.packageId, number: path.revision, contentId: path.contentId } },
      parseAs: "blob",
    }),
  );
  return data as unknown as Blob;
}
