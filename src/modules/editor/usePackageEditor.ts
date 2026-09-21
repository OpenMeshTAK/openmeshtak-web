import { computed, ref } from "vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import {
  createLayer,
  createObject,
  deleteLayer,
  deleteObject,
  getDataPackage,
  listLayers,
  listObjects,
  updateLayer,
  updateObject,
  type DataPackageDto,
  type PackageGeometry,
  type PackageLayerDto,
  type PackageObjectDto,
  type PackageObjectStyle,
  type TakMarker,
} from "@/modules/data-packages/data-packages.api";
import { useEditorHistory } from "./editor-history";
import { moveGeometry } from "./map/move-geometry";

/** What the editor shows next to the data package name (EDITOR.md: saved, saving, conflicted, invalid). */
export type SaveState = "saved" | "saving" | "error" | "conflict";

export interface ObjectDetails {
  name: string;
  description: string | null;
  style: PackageObjectStyle;
  /** TAK symbol of a marker; `null` is a plain spot marker. */
  tak: TakMarker | null;
}

/** Mirrors Core's limit so a too large circle gets a helpful hint instead of a rejection. */
const MAX_CIRCLE_RADIUS_METRES = 100_000;

const KIND_NAMES = { Point: "Point", LineString: "Line", Polygon: "Area", Circle: "Circle" } as const;

/** API DTOs contain JSON values; copying them detaches history snapshots from Vue's reactive proxies. */
function cloneDto<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface EntityHandle {
  id: string;
}

interface LayerState {
  handle: EntityHandle;
  name: string;
  sortOrder: number;
  visible: boolean;
  locked: boolean;
}

interface ObjectState {
  handle: EntityHandle;
  layer: EntityHandle;
  name: string;
  description: string | null;
  geometry: PackageGeometry;
  style: PackageObjectStyle;
  tak: TakMarker | null;
}

/**
 * Editor state for one data package draft. Every change is saved immediately through the API with the
 * object's version, so a concurrent edit surfaces as a conflict instead of being overwritten.
 */
export function usePackageEditor(eventId: string, packageId: string) {
  const path = { eventId, packageId };
  const toast = useToast();

  const dataPackage = ref<DataPackageDto | null>(null);
  const layers = ref<PackageLayerDto[]>([]);
  const objects = ref<PackageObjectDto[]>([]);
  const loadState = ref<"loading" | "ready" | "error">("loading");
  const saveState = ref<SaveState>("saved");
  const selectedId = ref<string | null>(null);
  const activeLayerId = ref<string | null>(null);
  const history = useEditorHistory();
  const layerHandles = new Map<string, EntityHandle>();
  const objectHandles = new Map<string, EntityHandle>();

  const sortedLayers = computed(() => [...layers.value].sort((a, b) => a.sortOrder - b.sortOrder));
  const selected = computed(() => objects.value.find(({ id }) => id === selectedId.value) ?? null);
  const activeLayer = computed(() => layers.value.find(({ id }) => id === activeLayerId.value) ?? null);

  function handleFor(store: Map<string, EntityHandle>, id: string): EntityHandle {
    let handle = store.get(id);
    if (handle === undefined) {
      handle = { id };
      store.set(id, handle);
    }
    return handle;
  }

  function replaceHandleId(store: Map<string, EntityHandle>, handle: EntityHandle, id: string): void {
    store.delete(handle.id);
    handle.id = id;
    store.set(id, handle);
  }

  function resetHistory(): void {
    history.clear();
    layerHandles.clear();
    objectHandles.clear();
  }

  function recordHistory(label: string, undo: () => Promise<boolean>, redo: () => Promise<boolean>): void {
    history.record({ label, undo, redo });
  }

  async function load(): Promise<void> {
    loadState.value = "loading";
    try {
      [dataPackage.value, layers.value, objects.value] = await Promise.all([
        getDataPackage(path),
        listLayers(path),
        listObjects(path),
      ]);
      resetHistory();
      for (const layer of layers.value) {
        handleFor(layerHandles, layer.id);
      }
      for (const object of objects.value) {
        handleFor(objectHandles, object.id);
      }
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
        toast.warning("Someone else changed this data package. The latest version was loaded.");
        await load();
        saveState.value = "saved";
      } else {
        saveState.value = "error";
        toast.error(caught);
      }
      return null;
    }
  }

  function replaceObject(object: PackageObjectDto): void {
    objects.value = objects.value.map((existing) => (existing.id === object.id ? object : existing));
  }

  function replaceLayer(layer: PackageLayerDto): void {
    layers.value = layers.value.map((existing) => (existing.id === layer.id ? layer : existing));
  }

  function layerStateOf(layer: PackageLayerDto): LayerState {
    return {
      handle: handleFor(layerHandles, layer.id),
      name: layer.name,
      sortOrder: layer.sortOrder,
      visible: layer.visible,
      locked: layer.locked,
    };
  }

  function objectStateOf(object: PackageObjectDto): ObjectState {
    return {
      handle: handleFor(objectHandles, object.id),
      layer: handleFor(layerHandles, object.layerId),
      name: object.name,
      description: object.description,
      geometry: cloneDto(object.geometry),
      style: cloneDto(object.style),
      tak: cloneDto(object.tak),
    };
  }

  async function applyLayerState(state: LayerState): Promise<boolean> {
    const layer = layers.value.find(({ id }) => id === state.handle.id);
    if (layer === undefined) {
      return false;
    }
    const updated = await save(() =>
      updateLayer(path, layer.id, {
        version: layer.version,
        name: state.name,
        sortOrder: state.sortOrder,
        visible: state.visible,
        locked: state.locked,
      }),
    );
    if (updated === null) {
      return false;
    }
    replaceLayer(updated);
    return true;
  }

  async function applyLayerStates(states: LayerState[]): Promise<boolean> {
    for (const state of states) {
      if (!(await applyLayerState(state))) {
        return false;
      }
    }
    return true;
  }

  async function createLayerFromState(state: LayerState): Promise<boolean> {
    const created = await save(() => createLayer(path, state.name));
    if (created === null) {
      return false;
    }
    layers.value = [...layers.value, created];
    replaceHandleId(layerHandles, state.handle, created.id);
    activeLayerId.value = created.id;
    return applyLayerState(state);
  }

  async function removeLayerByHandle(handle: EntityHandle): Promise<boolean> {
    const removed = await save(() => deleteLayer(path, handle.id));
    if (removed === null) {
      return false;
    }
    layers.value = layers.value.filter(({ id }) => id !== handle.id);
    const removedObjectIds = new Set(objects.value.filter(({ layerId }) => layerId === handle.id).map(({ id }) => id));
    objects.value = objects.value.filter(({ layerId }) => layerId !== handle.id);
    if (selectedId.value !== null && removedObjectIds.has(selectedId.value)) {
      selectedId.value = null;
    }
    if (activeLayerId.value === handle.id) {
      activeLayerId.value = sortedLayers.value.at(-1)?.id ?? null;
    }
    return true;
  }

  async function applyObjectState(state: ObjectState): Promise<boolean> {
    const object = objects.value.find(({ id }) => id === state.handle.id);
    if (object === undefined) {
      return false;
    }
    const updated = await save(() =>
      updateObject(path, object.id, {
        version: object.version,
        layerId: state.layer.id,
        name: state.name,
        description: state.description,
        geometry: state.geometry,
        style: state.style,
        tak: state.tak,
      }),
    );
    if (updated === null) {
      return false;
    }
    replaceObject(updated);
    return true;
  }

  async function createObjectFromState(state: ObjectState): Promise<boolean> {
    const created = await save(() =>
      createObject(path, {
        layerId: state.layer.id,
        name: state.name,
        description: state.description,
        geometry: state.geometry,
        style: state.style,
        tak: state.tak,
      }),
    );
    if (created === null) {
      return false;
    }
    objects.value = [...objects.value, created];
    replaceHandleId(objectHandles, state.handle, created.id);
    selectedId.value = created.id;
    return true;
  }

  async function removeObjectByHandle(handle: EntityHandle): Promise<boolean> {
    const removed = await save(() => deleteObject(path, handle.id));
    if (removed === null) {
      return false;
    }
    objects.value = objects.value.filter(({ id }) => id !== handle.id);
    if (selectedId.value === handle.id) {
      selectedId.value = null;
    }
    return true;
  }

  // ---- Objects --------------------------------------------------------------------------------

  async function addObject(geometry: PackageGeometry): Promise<void> {
    const layer = activeLayer.value;
    if (layer === null || layer.locked) {
      toast.warning("Choose an unlocked layer before drawing.");
      return;
    }
    if (geometry.type === "Circle" && geometry.radius > MAX_CIRCLE_RADIUS_METRES) {
      toast.warning("Circles can have a radius of at most 100 km. Zoom in and draw a smaller circle.");
      return;
    }
    const sameKind = objects.value.filter((object) => object.geometry.type === geometry.type).length;
    const created = await save(() =>
      createObject(path, { layerId: layer.id, name: `${KIND_NAMES[geometry.type]} ${String(sameKind + 1)}`, geometry }),
    );
    if (created !== null) {
      objects.value = [...objects.value, created];
      selectedId.value = created.id;
      const state = objectStateOf(created);
      recordHistory("Add object", () => removeObjectByHandle(state.handle), () => createObjectFromState(state));
    }
  }

  function fullUpdate(object: PackageObjectDto, changes: Partial<ObjectDetails & { geometry: PackageGeometry; layerId: string }>) {
    return updateObject(path, object.id, {
      version: object.version,
      layerId: changes.layerId ?? object.layerId,
      name: changes.name ?? object.name,
      description: changes.description === undefined ? object.description : changes.description,
      geometry: changes.geometry ?? object.geometry,
      style: changes.style ?? object.style,
      tak: changes.tak === undefined ? object.tak : changes.tak,
    });
  }

  async function changeObject(
    objectId: string,
    changes: Partial<ObjectDetails & { geometry: PackageGeometry; layerId: string }>,
  ): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object === undefined) {
      return;
    }
    const before = objectStateOf(object);
    const updated = await save(() => fullUpdate(object, changes));
    if (updated !== null) {
      replaceObject(updated);
      const after = objectStateOf(updated);
      recordHistory("Edit object", () => applyObjectState(before), () => applyObjectState(after));
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
        tak: object.tak,
      }),
    );
    if (copy !== null) {
      objects.value = [...objects.value, copy];
      selectedId.value = copy.id;
      const state = objectStateOf(copy);
      recordHistory("Duplicate object", () => removeObjectByHandle(state.handle), () => createObjectFromState(state));
    }
  }

  // ---- Clipboard ------------------------------------------------------------------------------

  /** Kept in memory for this editor session only; it never leaves the browser tab. */
  const clipboard = ref<PackageObjectDto | null>(null);

  function copySelected(): void {
    clipboard.value = selected.value;
    if (selected.value !== null) {
      toast.info(`Copied ${selected.value.name}.`);
    }
  }

  /** Pastes into the active layer, at `position` when given (the cursor) or in place. */
  async function paste(position: number[] | null): Promise<void> {
    const source = clipboard.value;
    const layer = activeLayer.value;
    if (source === null) {
      return;
    }
    if (layer === null || layer.locked) {
      toast.warning("Choose an unlocked layer before pasting.");
      return;
    }
    const created = await save(() =>
      createObject(path, {
        layerId: layer.id,
        name: source.name,
        description: source.description,
        geometry: position === null ? source.geometry : moveGeometry(source.geometry, position),
        style: source.style,
        tak: source.tak,
      }),
    );
    if (created !== null) {
      objects.value = [...objects.value, created];
      selectedId.value = created.id;
      const state = objectStateOf(created);
      recordHistory("Paste object", () => removeObjectByHandle(state.handle), () => createObjectFromState(state));
    }
  }

  async function removeObject(objectId: string): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object === undefined) {
      return;
    }
    const state = objectStateOf(object);
    if (await removeObjectByHandle(state.handle)) {
      recordHistory("Delete object", () => createObjectFromState(state), () => removeObjectByHandle(state.handle));
    }
  }

  // ---- Layers ---------------------------------------------------------------------------------

  /** First free "Layer N", so names stay unique after layers were deleted. */
  function nextLayerName(): string {
    const names = new Set(layers.value.map(({ name }) => name));
    let number = layers.value.length + 1;
    while (names.has(`Layer ${String(number)}`)) {
      number += 1;
    }
    return `Layer ${String(number)}`;
  }

  async function addLayer(): Promise<void> {
    const created = await save(() => createLayer(path, nextLayerName()));
    if (created !== null) {
      layers.value = [...layers.value, created];
      activeLayerId.value = created.id;
      const state = layerStateOf(created);
      recordHistory("Add layer", () => removeLayerByHandle(state.handle), () => createLayerFromState(state));
    }
  }

  async function changeLayer(
    layer: PackageLayerDto,
    changes: Partial<Pick<PackageLayerDto, "name" | "visible" | "locked" | "sortOrder">>,
  ): Promise<void> {
    const current = layers.value.find(({ id }) => id === layer.id);
    if (current === undefined) {
      return;
    }
    const before = layerStateOf(current);
    const after: LayerState = {
      ...before,
      name: changes.name ?? current.name,
      sortOrder: changes.sortOrder ?? current.sortOrder,
      visible: changes.visible ?? current.visible,
      locked: changes.locked ?? current.locked,
    };
    if (await applyLayerState(after)) {
      recordHistory("Edit layer", () => applyLayerState(before), () => applyLayerState(after));
    }
  }

  /** Swaps the drawing order with the neighbour above (`-1`) or below (`1`) in the list. */
  async function moveLayer(layer: PackageLayerDto, direction: -1 | 1): Promise<void> {
    const ordered = sortedLayers.value;
    const neighbour = ordered[ordered.findIndex(({ id }) => id === layer.id) + direction];
    if (neighbour === undefined) {
      return;
    }
    const before = [layerStateOf(layer), layerStateOf(neighbour)];
    const after = [
      { ...before[0]!, sortOrder: neighbour.sortOrder },
      { ...before[1]!, sortOrder: layer.sortOrder },
    ];
    if (await applyLayerStates(after)) {
      recordHistory("Move layer", () => applyLayerStates([...before].reverse()), () => applyLayerStates(after));
    }
  }

  /**
   * Moves a layer to the position of another (drag and drop) and renumbers the drawing order.
   * Only layers whose number changes are saved.
   */
  async function reorderLayer(layerId: string, targetLayerId: string): Promise<void> {
    const ordered = sortedLayers.value.filter(({ id }) => id !== layerId);
    const dragged = layers.value.find(({ id }) => id === layerId);
    const targetIndex = ordered.findIndex(({ id }) => id === targetLayerId);
    if (dragged === undefined || targetIndex === -1) {
      return;
    }
    // Dropping onto a layer below the dragged one places it under that layer, and vice versa.
    const insertAt = dragged.sortOrder > (ordered[targetIndex]?.sortOrder ?? 0) ? targetIndex : targetIndex + 1;
    ordered.splice(insertAt, 0, dragged);
    const changed = ordered
      .map((layer, sortOrder) => ({ layer, sortOrder }))
      .filter(({ layer, sortOrder }) => layer.sortOrder !== sortOrder);
    const before = changed.map(({ layer }) => layerStateOf(layer));
    const after = changed.map(({ layer, sortOrder }) => ({ ...layerStateOf(layer), sortOrder }));
    if (after.length > 0 && (await applyLayerStates(after))) {
      recordHistory("Reorder layers", () => applyLayerStates([...before].reverse()), () => applyLayerStates(after));
    }
  }

  async function moveObjectToLayer(objectId: string, layerId: string): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object !== undefined && object.layerId !== layerId) {
      await changeObject(objectId, { layerId });
    }
  }

  async function removeLayer(layer: PackageLayerDto): Promise<void> {
    const current = layers.value.find(({ id }) => id === layer.id);
    if (current === undefined) {
      return;
    }
    const layerState = layerStateOf(current);
    const objectStates = objects.value.filter(({ layerId }) => layerId === layer.id).map(objectStateOf);
    if (await removeLayerByHandle(layerState.handle)) {
      recordHistory(
        "Delete layer",
        async () => {
          if (!(await createLayerFromState(layerState))) {
            return false;
          }
          for (const state of objectStates) {
            if (!(await createObjectFromState(state))) {
              return false;
            }
          }
          return true;
        },
        () => removeLayerByHandle(layerState.handle),
      );
    }
  }

  function clearHistory(): void {
    resetHistory();
    for (const layer of layers.value) {
      handleFor(layerHandles, layer.id);
    }
    for (const object of objects.value) {
      handleFor(objectHandles, object.id);
    }
  }

  return {
    path,
    dataPackage,
    layers,
    sortedLayers,
    objects,
    loadState,
    saveState,
    selectedId,
    selected,
    activeLayerId,
    activeLayer,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoLabel: history.undoLabel,
    redoLabel: history.redoLabel,
    undoSequence: history.undoSequence,
    redoSequence: history.redoSequence,
    undo: history.undo,
    redo: history.redo,
    clearHistory,
    load,
    addObject,
    changeObject,
    duplicateObject,
    removeObject,
    clipboard,
    copySelected,
    paste,
    addLayer,
    changeLayer,
    moveLayer,
    reorderLayer,
    moveObjectToLayer,
    removeLayer,
  };
}

export type PackageEditor = ReturnType<typeof usePackageEditor>;
