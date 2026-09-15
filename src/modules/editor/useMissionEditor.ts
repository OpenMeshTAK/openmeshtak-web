import { computed, ref } from "vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import {
  createLayer,
  createObject,
  deleteLayer,
  deleteObject,
  getMission,
  listLayers,
  listObjects,
  updateLayer,
  updateObject,
  type MissionDto,
  type MissionGeometry,
  type MissionLayerDto,
  type MissionObjectDto,
  type MissionObjectStyle,
} from "@/modules/missions/missions.api";

/** What the editor shows next to the mission name (EDITOR.md: saved, saving, conflicted, invalid). */
export type SaveState = "saved" | "saving" | "error" | "conflict";

export interface ObjectDetails {
  name: string;
  description: string | null;
  style: MissionObjectStyle;
}

const KIND_NAMES = { Point: "Point", LineString: "Line", Polygon: "Area" } as const;

/**
 * Editor state for one mission draft. Every change is saved immediately through the API with the
 * object's version, so a concurrent edit surfaces as a conflict instead of being overwritten.
 */
export function useMissionEditor(eventId: string, missionId: string) {
  const path = { eventId, missionId };
  const toast = useToast();

  const mission = ref<MissionDto | null>(null);
  const layers = ref<MissionLayerDto[]>([]);
  const objects = ref<MissionObjectDto[]>([]);
  const loadState = ref<"loading" | "ready" | "error">("loading");
  const saveState = ref<SaveState>("saved");
  const selectedId = ref<string | null>(null);
  const activeLayerId = ref<string | null>(null);

  const sortedLayers = computed(() => [...layers.value].sort((a, b) => a.sortOrder - b.sortOrder));
  const selected = computed(() => objects.value.find(({ id }) => id === selectedId.value) ?? null);
  const activeLayer = computed(() => layers.value.find(({ id }) => id === activeLayerId.value) ?? null);

  async function load(): Promise<void> {
    loadState.value = "loading";
    try {
      [mission.value, layers.value, objects.value] = await Promise.all([
        getMission(path),
        listLayers(path),
        listObjects(path),
      ]);
      activeLayerId.value ??= sortedLayers.value.at(-1)?.id ?? null;
      loadState.value = "ready";
    } catch {
      loadState.value = "error";
    }
  }

  /** Runs one save and keeps the indicator honest; a conflict reloads the latest draft. */
  async function save<T>(action: () => Promise<T>): Promise<T | null> {
    saveState.value = "saving";
    try {
      const result = await action();
      saveState.value = "saved";
      return result;
    } catch (caught: unknown) {
      if (isApiProblem(caught, "VERSION_CONFLICT")) {
        saveState.value = "conflict";
        toast.warning("Someone else changed this mission. The latest version was loaded.");
        await load();
        saveState.value = "saved";
      } else {
        saveState.value = "error";
        toast.error(caught);
      }
      return null;
    }
  }

  function replaceObject(object: MissionObjectDto): void {
    objects.value = objects.value.map((existing) => (existing.id === object.id ? object : existing));
  }

  function replaceLayer(layer: MissionLayerDto): void {
    layers.value = layers.value.map((existing) => (existing.id === layer.id ? layer : existing));
  }

  // ---- Objects --------------------------------------------------------------------------------

  async function addObject(geometry: MissionGeometry): Promise<void> {
    const layer = activeLayer.value;
    if (layer === null || layer.locked) {
      toast.warning("Choose an unlocked layer before drawing.");
      return;
    }
    const sameKind = objects.value.filter((object) => object.geometry.type === geometry.type).length;
    const created = await save(() =>
      createObject(path, { layerId: layer.id, name: `${KIND_NAMES[geometry.type]} ${String(sameKind + 1)}`, geometry }),
    );
    if (created !== null) {
      objects.value = [...objects.value, created];
      selectedId.value = created.id;
    }
  }

  function fullUpdate(object: MissionObjectDto, changes: Partial<ObjectDetails & { geometry: MissionGeometry; layerId: string }>) {
    return updateObject(path, object.id, {
      version: object.version,
      layerId: changes.layerId ?? object.layerId,
      name: changes.name ?? object.name,
      description: changes.description === undefined ? object.description : changes.description,
      geometry: changes.geometry ?? object.geometry,
      style: changes.style ?? object.style,
    });
  }

  async function changeObject(
    objectId: string,
    changes: Partial<ObjectDetails & { geometry: MissionGeometry; layerId: string }>,
  ): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object === undefined) {
      return;
    }
    const updated = await save(() => fullUpdate(object, changes));
    if (updated !== null) {
      replaceObject(updated);
    } else {
      // Put the map back to the saved geometry, e.g. after an invalid edit.
      objects.value = [...objects.value];
    }
  }

  async function duplicateObject(objectId: string): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object === undefined) {
      return;
    }
    const copy = await save(() =>
      createObject(path, {
        layerId: object.layerId,
        name: `${object.name} copy`.slice(0, 100),
        description: object.description,
        geometry: object.geometry,
        style: object.style,
      }),
    );
    if (copy !== null) {
      objects.value = [...objects.value, copy];
      selectedId.value = copy.id;
    }
  }

  async function removeObject(objectId: string): Promise<void> {
    const removed = await save(() => deleteObject(path, objectId));
    if (removed !== null) {
      objects.value = objects.value.filter(({ id }) => id !== objectId);
      if (selectedId.value === objectId) {
        selectedId.value = null;
      }
    }
  }

  // ---- Layers ---------------------------------------------------------------------------------

  async function addLayer(): Promise<void> {
    const created = await save(() => createLayer(path, `Layer ${String(layers.value.length + 1)}`));
    if (created !== null) {
      layers.value = [...layers.value, created];
      activeLayerId.value = created.id;
    }
  }

  async function changeLayer(
    layer: MissionLayerDto,
    changes: Partial<Pick<MissionLayerDto, "name" | "visible" | "locked" | "sortOrder">>,
  ): Promise<void> {
    const updated = await save(() =>
      updateLayer(path, layer.id, {
        version: layer.version,
        name: changes.name ?? layer.name,
        sortOrder: changes.sortOrder ?? layer.sortOrder,
        visible: changes.visible ?? layer.visible,
        locked: changes.locked ?? layer.locked,
      }),
    );
    if (updated !== null) {
      replaceLayer(updated);
    }
  }

  /** Swaps the drawing order with the neighbour above (`-1`) or below (`1`) in the list. */
  async function moveLayer(layer: MissionLayerDto, direction: -1 | 1): Promise<void> {
    const ordered = sortedLayers.value;
    const neighbour = ordered[ordered.findIndex(({ id }) => id === layer.id) + direction];
    if (neighbour === undefined) {
      return;
    }
    await changeLayer(layer, { sortOrder: neighbour.sortOrder });
    await changeLayer(neighbour, { sortOrder: layer.sortOrder });
  }

  async function removeLayer(layer: MissionLayerDto): Promise<void> {
    const removed = await save(() => deleteLayer(path, layer.id));
    if (removed !== null) {
      layers.value = layers.value.filter(({ id }) => id !== layer.id);
      objects.value = objects.value.filter(({ layerId }) => layerId !== layer.id);
      if (activeLayerId.value === layer.id) {
        activeLayerId.value = sortedLayers.value.at(-1)?.id ?? null;
      }
    }
  }

  return {
    path,
    mission,
    layers,
    sortedLayers,
    objects,
    loadState,
    saveState,
    selectedId,
    selected,
    activeLayerId,
    activeLayer,
    load,
    addObject,
    changeObject,
    duplicateObject,
    removeObject,
    addLayer,
    changeLayer,
    moveLayer,
    removeLayer,
  };
}

export type MissionEditor = ReturnType<typeof useMissionEditor>;
