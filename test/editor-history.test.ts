import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DataPackageDto,
  PackageLayerDto,
  PackageObjectDto,
} from "@/modules/data-packages/data-packages.api";

const dataPackageApi = vi.hoisted(() => ({
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
