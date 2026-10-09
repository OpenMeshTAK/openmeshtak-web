import type { PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import type { MapContentItem } from "@/modules/editor/map/map-content";
import { readImage, readTile, tileKey, type StoredSnapshot } from "./offline-store";

export interface OfflineMapData {
  layers: PackageLayerDto[];
  objects: PackageObjectDto[];
  contents: MapContentItem[];
  /** Object URLs of rubber-sheet images; revoke them when the view closes. */
  objectUrls: string[];
}

/**
 * Turns a stored snapshot into the shapes the shared map view draws. Packages are stored top
 * first, like the event's package list, so the first package is drawn last and stays on top.
 */
export async function offlineMapData(record: StoredSnapshot): Promise<OfflineMapData> {
  const packages = [...record.snapshot.packages].reverse();
  const layers = packages.flatMap((dataPackage) =>
    [...dataPackage.layers].sort((a, b) => a.sortOrder - b.sortOrder).map((layer) => ({ dataPackage, layer })),
  );
  const mapLayers: PackageLayerDto[] = layers.map(({ dataPackage, layer }, sortOrder) => ({
    id: layer.id,
    packageId: dataPackage.packageId,
    name: layer.name,
    sortOrder,
    visible: layer.visible,
    locked: true,
    version: 1,
    createdAt: dataPackage.publishedAt,
    updatedAt: dataPackage.publishedAt,
  }));
  const objects: PackageObjectDto[] = packages.flatMap((dataPackage) =>
    dataPackage.objects.map((object) => ({
      ...object,
      packageId: dataPackage.packageId,
      version: 1,
      createdAt: dataPackage.publishedAt,
      updatedAt: dataPackage.publishedAt,
    })),
  );

  const objectUrls: string[] = [];
  const contents: MapContentItem[] = [];
  for (const content of packages.flatMap(({ contents: packageContents }) => packageContents)) {
    if (content.kind === "tiles") {
      contents.push({
        id: content.id,
        layerId: content.layerId,
        kind: "tiles",
        visible: true,
        opacity: 1,
        // Never requested: `loadTile` reads every tile from browser storage.
        tileUrl: "offline-tiles/{z}/{x}/{y}",
        loadTile: (z, x, y) => readTile(tileKey(record.eventId, content.id, z, x, y)),
        minZoom: content.minZoom,
        maxZoom: content.maxZoom,
        bounds: content.bounds,
      });
      continue;
    }
    const image = await readImage(record.eventId, content.id);
    if (image === null) {
      continue;
    }
    const url = URL.createObjectURL(image);
    objectUrls.push(url);
    contents.push({ id: content.id, layerId: content.layerId, kind: "image", visible: true, opacity: 1, imageUrl: url, corners: content.corners });
  }
  return { layers: mapLayers, objects, contents, objectUrls };
}

/** Whether any stored content can serve as a background map. */
export function hasOfflineBasemap(record: StoredSnapshot): boolean {
  return record.snapshot.packages.some(({ contents }) => contents.some(({ kind }) => kind === "tiles"));
}
