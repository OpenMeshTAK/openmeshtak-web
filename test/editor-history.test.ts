import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DataPackageDto,
  PackageLayerDto,
  PackageObjectDto,
} from "@/modules/data-packages/data-packages.api";

const dataPackageApi = vi.hoisted(() => ({
  batchObjects: vi.fn(),
  createLayer: vi.fn(),
  createObject: vi.fn(),
  deleteLayer: vi.fn(),
  deleteObject: vi.fn(),
  getDataPackage: vi.fn(),
  getObject: vi.fn(),
  listLayers: vi.fn(),
  listObjects: vi.fn(),
  listContents: vi.fn(),
  updateLayer: vi.fn(),
  updateObject: vi.fn(),
}));

vi.mock("@/modules/data-packages/data-packages.api", () => dataPackageApi);

import { usePackageEditor } from "@/modules/editor/usePackageEditor";

const layer: PackageLayerDto = {
  id: "layer-1",
  packageId: "package-1",
  name: "Buildings",
  sortOrder: 0,
  visible: true,
  locked: false,
  version: 1,
  createdAt: "2026-10-05T00:00:00.000Z",
  updatedAt: "2026-10-05T00:00:00.000Z",
};

const dataPackage = {
  id: "package-1",
  eventId: "event-1",
  name: "Mission",
} as DataPackageDto;

function pointObject(id: string, layerId: string): PackageObjectDto {
  return {
    id,
    packageId: "package-1",
    layerId,
    kind: "point",
    name: "HQ",
    description: null,
    geometry: { type: "Point", coordinates: [10, 50] },
    style: { color: "#1976D2", strokeWidth: 2, fillOpacity: 0.2 },
    tak: null,
    version: 1,
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z",
  };
}

describe("package editor history", () => {
  let nextObject: number;
  let objectVersion: number;
  let nextLayer: number;
  let layerVersion: number;

  beforeEach(() => {
    vi.clearAllMocks();
    nextObject = 1;
    objectVersion = 1;
    nextLayer = 2;
    layerVersion = 2;
    dataPackageApi.getDataPackage.mockResolvedValue(dataPackage);
    dataPackageApi.listLayers.mockResolvedValue([layer]);
    dataPackageApi.listObjects.mockResolvedValue([]);
    dataPackageApi.listContents.mockResolvedValue([]);
    dataPackageApi.deleteObject.mockResolvedValue(undefined);
    dataPackageApi.deleteLayer.mockResolvedValue(undefined);
    dataPackageApi.createLayer.mockImplementation((_path: unknown, name: string) =>
      Promise.resolve({
        ...layer,
        id: `layer-${String(nextLayer++)}`,
        name,
        sortOrder: nextLayer - 2,
        version: layerVersion++,
      } satisfies PackageLayerDto),
    );
    dataPackageApi.updateLayer.mockImplementation((_path: unknown, id: string, body: PackageLayerDto) =>
      Promise.resolve({
        ...body,
        id,
        packageId: "package-1",
        version: layerVersion++,
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      } satisfies PackageLayerDto),
    );
    dataPackageApi.createObject.mockImplementation(
      (_path: unknown, body: Omit<PackageObjectDto, "id" | "packageId" | "kind" | "version" | "createdAt" | "updatedAt">) =>
        Promise.resolve({
          ...body,
          id: `object-${String(nextObject++)}`,
          packageId: "package-1",
          kind: "point",
          description: body.description ?? null,
          style: body.style ?? { color: "#1976D2", strokeWidth: 2, fillOpacity: 0.2 },
          tak: body.tak ?? null,
          version: objectVersion++,
          createdAt: "2026-10-05T00:00:00.000Z",
          updatedAt: "2026-10-05T00:00:00.000Z",
        } satisfies PackageObjectDto),
    );
    dataPackageApi.updateObject.mockImplementation((_path: unknown, id: string, body: PackageObjectDto) =>
      Promise.resolve({
        ...body,
        id,
        packageId: "package-1",
        kind: "point",
        version: objectVersion++,
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      } satisfies PackageObjectDto),
    );
    dataPackageApi.batchObjects.mockImplementation(async (path: unknown, body: { updates: Array<PackageObjectDto>; deletes: Array<{ id: string }>; creates: Array<PackageObjectDto> }) => ({
      updated: await Promise.all(body.updates.map((item) => dataPackageApi.updateObject(path, item.id, item))),
      created: await Promise.all(body.creates.map((item) => dataPackageApi.createObject(path, item))),
      deletedIds: body.deletes.map(({ id }) => id),
    }));
  });

  it("groups style and delete operations with replacement IDs through undo/redo", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();
    await editor.addObject({ type: "Point", coordinates: [10, 50] });
    await editor.addObject({ type: "Point", coordinates: [11, 50] });
    const ids = editor.objects.value.map(({ id }) => id);
    const originalStyles = editor.objects.value.map(({ style }) => JSON.parse(JSON.stringify(style)) as PackageObjectDto["style"]);
    await editor.styleObjects(ids, { color: "#FF0000" });
    expect(dataPackageApi.batchObjects).toHaveBeenCalledTimes(1);
    expect(editor.objects.value.every(({ style }) => style.color === "#FF0000")).toBe(true);
    await editor.undo();
    expect(editor.objects.value.map(({ style }) => style)).toEqual(originalStyles);
    await editor.redo();
    await editor.removeObjects(ids);
    expect(editor.objects.value).toEqual([]);
    await editor.undo();
    const replacements = editor.objects.value.map(({ id }) => id);
    expect(replacements).not.toEqual(ids);
    expect(replacements).toHaveLength(2);
    await editor.redo();
    expect(editor.objects.value).toEqual([]);
    await editor.undo();
    await editor.undo();
    expect(editor.objects.value.every(({ style }) => style.color !== "#FF0000")).toBe(true);
  });

  it("rejects locked group edits and preserves state/history after a failed batch", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();
    await editor.addObject({ type: "Point", coordinates: [10, 50] });
    const before = JSON.parse(JSON.stringify(editor.objects.value)) as PackageObjectDto[];
    dataPackageApi.batchObjects.mockRejectedValueOnce(new Error("Conflict"));
    await editor.styleObjects([before[0]!.id], { color: "#FF0000" });
    expect(editor.objects.value).toEqual(before);
    editor.layers.value = [{ ...layer, locked: true }];
    await editor.styleObjects([before[0]!.id], { color: "#FF0000" });
    expect(dataPackageApi.batchObjects).toHaveBeenCalledTimes(1);
    expect(editor.objects.value).toEqual(before);
  });

  it("invalidates an entire group step after one remotely changed member, preserving unrelated history", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();
    for (const longitude of [10, 11, 12]) await editor.addObject({ type: "Point", coordinates: [longitude, 50] });
    await editor.styleObjects(["object-1", "object-2"], { color: "#FF0000" });
    await editor.changeObject("object-3", { name: "Independent" });
    const remote = { ...editor.objects.value[0]!, name: "Remote", version: 99 };
    dataPackageApi.listObjects.mockResolvedValue([remote, ...editor.objects.value.slice(1)]);
    await editor.applyRemoteChange({ path: "objects/batch", method: "POST", createdId: null });
    await editor.undo();
    expect(editor.objects.value.find(({ id }) => id === "object-3")?.name).toBe("Point 3");
    await editor.undo();
    expect(editor.objects.value.map(({ id }) => id)).toEqual(["object-1", "object-2"]);
    expect(editor.objects.value[0]?.name).toBe("Remote");
    expect(editor.objects.value[1]?.style.color).toBe("#FF0000");
  });

  it("undoes and redoes object creation with the server-assigned replacement id", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();

    await editor.addObject({ type: "Point", coordinates: [10, 50] });
    expect(editor.objects.value.map(({ id }) => id)).toEqual(["object-1"]);
    expect(editor.canUndo.value).toBe(true);

    await editor.undo();
    expect(editor.objects.value).toEqual([]);
    expect(editor.canRedo.value).toBe(true);

    await editor.redo();
    expect(editor.objects.value.map(({ id }) => id)).toEqual(["object-2"]);
    expect(editor.selectedId.value).toBe("object-2");
  });

  it("keeps undo steps for other objects when someone else changes one", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();
    await editor.addObject({ type: "Point", coordinates: [10, 50] });
    await editor.addObject({ type: "Point", coordinates: [11, 51] });
    await editor.changeObject("object-1", { name: "Alpha" });
    await editor.changeObject("object-2", { name: "Bravo" });

    const remote = { ...editor.objects.value[0]!, name: "Changed elsewhere", version: 99 };
    dataPackageApi.getObject.mockResolvedValue(remote);
    await editor.applyRemoteChange({ path: "objects/object-1", method: "PUT", createdId: null });
    expect(editor.objects.value[0]?.name).toBe("Changed elsewhere");

    // Only the steps for object-2 remain: undoing reverts its rename, then its creation.
    await editor.undo();
    expect(editor.objects.value.find(({ id }) => id === "object-2")?.name).toBe("Point 2");
    await editor.undo();
    expect(editor.objects.value.map(({ id }) => id)).toEqual(["object-1"]);
    expect(editor.canUndo.value).toBe(false);
    expect(editor.objects.value[0]?.name).toBe("Changed elsewhere");
  });

  it("restores arrow geometry and presentation through edit undo/redo and recreation", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();
    const geometry = { type: "LineString" as const, coordinates: [[10, 50], [11, 51], [12, 50]] };
    await editor.addObject(geometry, true);
    const original = editor.objects.value[0]!;
    expect(original.style.arrowHeads).toBe("end");
    const changedStyle = { ...original.style, arrowHeads: "both" as const, arrowHeadSize: 32 };
    await editor.changeObject(original.id, { style: changedStyle });
    await editor.undo();
    expect(editor.objects.value[0]?.style).toEqual(original.style);
    expect(editor.objects.value[0]?.id).toBe(original.id);
    await editor.redo();
    expect(editor.objects.value[0]?.style).toEqual(changedStyle);
    await editor.removeObject(original.id);
    await editor.undo();
    expect(editor.objects.value[0]?.geometry).toEqual(geometry);
    expect(editor.objects.value[0]?.style).toEqual(changedStyle);
  });

  it("restores object edits and deletions across recreated ids", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();
    await editor.addObject({ type: "Point", coordinates: [10, 50] });

    await editor.changeObject("object-1", { name: "HQ" });
    expect(editor.objects.value[0]?.name).toBe("HQ");
    await editor.undo();
    expect(editor.objects.value[0]?.name).toBe("Point 1");
    await editor.redo();
    expect(editor.objects.value[0]?.name).toBe("HQ");

    await editor.removeObject("object-1");
    expect(editor.objects.value).toEqual([]);
    await editor.undo();
    expect(editor.objects.value[0]).toMatchObject({ id: "object-2", name: "HQ" });
    await editor.redo();
    expect(editor.objects.value).toEqual([]);
  });

  it("undoes and redoes layer creation with a replacement id", async () => {
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();

    await editor.addLayer();
    expect(editor.layers.value.map(({ id }) => id)).toEqual(["layer-1", "layer-2"]);

    await editor.undo();
    expect(editor.layers.value.map(({ id }) => id)).toEqual(["layer-1"]);

    await editor.redo();
    expect(editor.layers.value.map(({ id }) => id)).toEqual(["layer-1", "layer-3"]);
    expect(editor.activeLayerId.value).toBe("layer-3");
  });

  it("restores a deleted layer and its objects before deleting them again", async () => {
    const secondLayer = { ...layer, id: "layer-2", name: "Game area", sortOrder: 1 };
    nextLayer = 3;
    dataPackageApi.listLayers.mockResolvedValue([layer, secondLayer]);
    dataPackageApi.listObjects.mockResolvedValue([pointObject("existing-object", secondLayer.id)]);
    const editor = usePackageEditor("event-1", "package-1");
    await editor.load();

    await editor.removeLayer(secondLayer);
    expect(editor.layers.value.map(({ id }) => id)).toEqual(["layer-1"]);
    expect(editor.objects.value).toEqual([]);

    await editor.undo();
    expect(editor.layers.value).toEqual(expect.arrayContaining([expect.objectContaining({ id: "layer-3", name: "Game area" })]));
    expect(editor.objects.value).toEqual([expect.objectContaining({ id: "object-1", layerId: "layer-3", name: "HQ" })]);

    await editor.redo();
    expect(editor.layers.value.map(({ id }) => id)).toEqual(["layer-1"]);
    expect(editor.objects.value).toEqual([]);
  });
});
