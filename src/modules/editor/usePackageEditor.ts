import { computed, ref, watch } from "vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import {
  createLayer,
  batchObjects,
  createObject,
  deleteLayer,
  deleteObject,
  getDataPackage,
  getObject,
  listContents,
  deleteContent,
  updateContent,
  type ContentChanges,
  listLayers,
  listObjects,
  updateLayer,
  updateObject,
  type DataPackageDto,
  type PackageGeometry,
  type PackageLayerDto,
  type PackageContentDto,
  type PackageObjectDto,
  type PackageObjectStyle,
  type TakMarker,
} from "@/modules/data-packages/data-packages.api";
import { useEditorHistory } from "./editor-history";
import { moveGeometry } from "./map/move-geometry";
import { copyGeometry } from "./map/route-editing";

/** What the editor shows next to the data package name, so authors always know whether edits are saved. */
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

const KIND_NAMES = { Point: "Point", LineString: "Line", Polygon: "Area", Circle: "Circle", Rectangle: "Rectangle", Ellipse: "Ellipse", Route: "Route" } as const;

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

/** What another tab or person changed in this package, as announced by Core. */
export interface RemotePackageChange {
  /** Route below the package, e.g. `objects/<id>`, `layers` or empty for the package itself. */
  path: string;
  method: string;
  createdId: string | null;
}

// Core validated the IDs before announcing the change.
const OBJECT_PATH = /^objects\/([^/]+)$/;
const LAYER_PATH = /^layers(?:\/[^/]+)?$/;
const PACKAGE_DETAILS_PATH = /^(?:|revisions|audience|tak-delivery)$/;

/**
 * Editor state for one data package draft. Every change is saved immediately through the API with the
 * object's version, so a concurrent edit surfaces as a conflict instead of being overwritten.
 *
 * Several people may edit at once. Changes from elsewhere are applied per object or layer, so the
 * local undo history survives. The other person's change wins: undo steps of this tab that would
 * overwrite it are dropped, steps for everything else stay.
 */
export function usePackageEditor(eventId: string, packageId: string) {
  const path = { eventId, packageId };
  const toast = useToast();

  const dataPackage = ref<DataPackageDto | null>(null);
  const layers = ref<PackageLayerDto[]>([]);
  const objects = ref<PackageObjectDto[]>([]);
  /** Read-only map content (offline maps, rubber sheets) kept from imports. */
  const contents = ref<PackageContentDto[]>([]);
  const loadState = ref<"loading" | "ready" | "error">("loading");
  const saveState = ref<SaveState>("saved");
  const selectedId = ref<string | null>(null);
  const selectedIds = ref<string[]>([]);
  watch(selectedId, (id) => { if (id !== selectedIds.value[0]) selectedIds.value = id === null ? [] : [id]; }, { flush: "sync" });
  const activeLayerId = ref<string | null>(null);
  const history = useEditorHistory();
  const layerHandles = new Map<string, EntityHandle>();
  const objectHandles = new Map<string, EntityHandle>();

  const sortedLayers = computed(() => [...layers.value].sort((a, b) => a.sortOrder - b.sortOrder));
  const selected = computed(() => objects.value.find(({ id }) => id === selectedId.value) ?? null);
  const selectedObjects = computed(() => objects.value.filter(({ id }) => selectedIds.value.includes(id)));

  function selectObjects(ids: string[]): void {
    selectedIds.value = ids.filter((id) => objects.value.some((object) => object.id === id)).slice(0, 500);
    selectedId.value = selectedIds.value[0] ?? null;
  }
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

  function recordHistory(label: string, touches: readonly EntityHandle[], undo: () => Promise<boolean>, redo: () => Promise<boolean>): void {
    history.record({ label, undo, redo, touches });
  }

  async function load(): Promise<void> {
    loadState.value = "loading";
    try {
      [dataPackage.value, layers.value, objects.value, contents.value] = await Promise.all([
        getDataPackage(path),
        listLayers(path),
        listObjects(path),
        listContents(path),
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
        toast.warning("Someone else changed this just before you. Their version is shown; your change was not saved.");
        await syncAll().catch(() => load());
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

  async function applyObjectStates(states: ObjectState[], mode: "update" | "delete" | "create"): Promise<boolean> {
    if (saveState.value === "saving") return false;
    const live = states.map((state) => objects.value.find(({ id }) => id === state.handle.id));
    if (mode !== "create" && live.some((object) => object === undefined)) return false;
    if (states.some((state) => layers.value.find(({ id }) => id === state.layer.id)?.locked !== false)) return false;
    const bodies = states.map((state) => ({ layerId: state.layer.id, name: state.name, description: state.description,
      geometry: cloneDto(state.geometry), style: cloneDto(state.style), tak: cloneDto(state.tak) }));
    const result = await save(() => batchObjects(path, {
      updates: mode === "update" ? bodies.map((body, index) => ({ ...body, id: states[index]!.handle.id, version: live[index]!.version })) : [],
      deletes: mode === "delete" ? live.map((object) => ({ id: object!.id, version: object!.version })) : [],
      creates: mode === "create" ? bodies : [],
    }));
    if (result === null) { objects.value = [...objects.value]; return false; }
    const updated = new Map(result.updated.map((object) => [object.id, object]));
    objects.value = [...objects.value.filter(({ id }) => !result.deletedIds.includes(id)).map((object) => updated.get(object.id) ?? object), ...result.created];
    result.created.forEach((object, index) => replaceHandleId(objectHandles, states[index]!.handle, object.id));
    selectObjects(mode === "delete" ? [] : states.map((state) => state.handle.id));
    return true;
  }

  async function changeObjects(changes: Array<{ id: string; geometry?: PackageGeometry; style?: PackageObjectStyle }>): Promise<void> {
    const live = changes.map(({ id }) => objects.value.find((object) => object.id === id));
    if (live.some((object) => object === undefined) || changes.length === 0) return;
    const before = live.map((object) => objectStateOf(object!));
    const after = before.map((state, index) => ({ ...state, geometry: cloneDto(changes[index]?.geometry ?? state.geometry), style: cloneDto(changes[index]?.style ?? state.style) }));
    if (await applyObjectStates(after, "update")) recordHistory("Edit selection", before.flatMap((state) => [state.handle, state.layer]),
      () => applyObjectStates(before, "update"), () => applyObjectStates(after, "update"));
  }

  async function removeObjects(ids: string[]): Promise<void> {
    const states = objects.value.filter((object) => ids.includes(object.id)).map(objectStateOf);
    if (states.length === 0 || states.length !== new Set(ids).size) return;
    if (await applyObjectStates(states, "delete")) recordHistory("Delete selection", states.flatMap((state) => [state.handle, state.layer]),
      () => applyObjectStates(states, "create"), () => applyObjectStates(states, "delete"));
  }

  async function styleObjects(ids: string[], patch: Partial<PackageObjectStyle>): Promise<void> {
    await changeObjects(objects.value.filter((object) => ids.includes(object.id)).map((object) => ({ id: object.id, style: { ...object.style, ...patch } })));
  }

  async function addObject(geometry: PackageGeometry, presentation: boolean | "sector" | "range-bearing" | "range-circle" | "bullseye" = false): Promise<void> {
    const arrow = presentation === true;
    const style: PackageObjectStyle = { color: "#1E88E5", strokeWidth: 3, fillOpacity: 0.25,
      ...(arrow ? { arrowHeads: "end", arrowHeadSize: 16 } : {}),
      ...(presentation === "range-circle" ? { rangeCircle: true, rangeRings: 3 } : {}),
      ...(presentation === "bullseye" && geometry.type === "Circle" ? { bullseye: { ringDistance: geometry.radius / 3, ringCount: 3, ringsVisible: true, edgeToCenter: false } } : {}),
      ...(presentation === "sector" ? { sector: { heading: 0, sweep: 60, radius: 100 } } : {}),
      ...(presentation === "range-bearing" ? { rangeBearing: true, distanceUnit: "m", arrowHeads: "end" } : {}),
    };
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
      createObject(path, { layerId: layer.id, name: `${arrow ? "Arrow" : typeof presentation === "string" ? presentation : KIND_NAMES[geometry.type]} ${String(sameKind + 1)}`, geometry,
        ...(presentation === false ? {} : { style }),
      }),
    );
    if (created !== null) {
      objects.value = [...objects.value, created];
      selectedId.value = created.id;
      const state = objectStateOf(created);
      recordHistory("Add object", [state.handle, state.layer], () => removeObjectByHandle(state.handle), () => createObjectFromState(state));
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
      recordHistory("Edit object", [before.handle, before.layer, after.layer], () => applyObjectState(before), () => applyObjectState(after));
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
        geometry: copyGeometry(object.geometry),
        style: object.style,
        tak: object.tak,
      }),
    );
    if (copy !== null) {
      objects.value = [...objects.value, copy];
      selectedId.value = copy.id;
      const state = objectStateOf(copy);
      recordHistory("Duplicate object", [state.handle, state.layer], () => removeObjectByHandle(state.handle), () => createObjectFromState(state));
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
        geometry: copyGeometry(position === null ? source.geometry : moveGeometry(source.geometry, position)),
        style: source.style,
        tak: source.tak,
      }),
    );
    if (created !== null) {
      objects.value = [...objects.value, created];
      selectedId.value = created.id;
      const state = objectStateOf(created);
      recordHistory("Paste object", [state.handle, state.layer], () => removeObjectByHandle(state.handle), () => createObjectFromState(state));
    }
  }

  async function removeObject(objectId: string): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object === undefined) {
      return;
    }
    const state = objectStateOf(object);
    if (await removeObjectByHandle(state.handle)) {
      recordHistory("Delete object", [state.handle, state.layer], () => createObjectFromState(state), () => removeObjectByHandle(state.handle));
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
      recordHistory("Add layer", [state.handle], () => removeLayerByHandle(state.handle), () => createLayerFromState(state));
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
      recordHistory("Edit layer", [before.handle], () => applyLayerState(before), () => applyLayerState(after));
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
      recordHistory("Move layer", before.map(({ handle }) => handle), () => applyLayerStates([...before].reverse()), () => applyLayerStates(after));
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
      recordHistory("Reorder layers", before.map(({ handle }) => handle), () => applyLayerStates([...before].reverse()), () => applyLayerStates(after));
    }
  }

  async function moveObjectToLayer(objectId: string, layerId: string): Promise<void> {
    const object = objects.value.find(({ id }) => id === objectId);
    if (object !== undefined && object.layerId !== layerId) {
      await changeObject(objectId, { layerId });
    }
  }

  /**
   * Map content edits save at once. They are not part of undo/redo: they never change drawn
   * objects, and removed content can be imported again.
   */
  async function changeContent(contentId: string, changes: ContentChanges): Promise<void> {
    const content = contents.value.find(({ id }) => id === contentId);
    if (content === undefined) {
      return;
    }
    const saved = await save(() => updateContent(path, content, changes));
    if (saved !== null) {
      contents.value = contents.value.map((current) => (current.id === contentId ? saved : current));
    }
  }

  async function removeContent(contentId: string): Promise<void> {
    const removed = await save(() => deleteContent(path, contentId));
    if (removed !== null) {
      contents.value = contents.value.filter(({ id }) => id !== contentId);
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
        [layerState.handle, ...objectStates.map(({ handle }) => handle)],
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

  // ---- Changes from other editors ----------------------------------------------------------------

  /** Drops this tab's undo steps for entities someone else changed or removed. */
  function forgetHistoryOf(objectIds: readonly string[], layerIds: readonly string[]): void {
    const handles = new Set<object>();
    for (const id of objectIds) {
      const handle = objectHandles.get(id);
      if (handle !== undefined) {
        handles.add(handle);
      }
    }
    for (const id of layerIds) {
      const handle = layerHandles.get(id);
      if (handle !== undefined) {
        handles.add(handle);
      }
    }
    if (handles.size > 0 && history.dropTouching(handles) > 0) {
      toast.info("Someone else changed something you edited. Your undo steps for it were removed.");
    }
  }

  function mergeObjects(remote: PackageObjectDto[]): void {
    const local = new Map(objects.value.map((object) => [object.id, object]));
    const remoteIds = new Set(remote.map(({ id }) => id));
    const changed = remote.filter((object) => {
      const existing = local.get(object.id);
      return existing !== undefined && existing.version !== object.version;
    });
    const removed = objects.value.filter(({ id }) => !remoteIds.has(id));
    forgetHistoryOf([...changed, ...removed].map(({ id }) => id), []);
    objects.value = remote;
    for (const object of remote) {
      handleFor(objectHandles, object.id);
    }
    if (selectedId.value !== null && !remoteIds.has(selectedId.value)) {
      selectedId.value = null;
    }
  }

  function mergeLayers(remote: PackageLayerDto[]): void {
    const local = new Map(layers.value.map((layer) => [layer.id, layer]));
    const remoteIds = new Set(remote.map(({ id }) => id));
    const changed = remote.filter((layer) => {
      const existing = local.get(layer.id);
      return existing !== undefined && existing.version !== layer.version;
    });
    const removed = layers.value.filter(({ id }) => !remoteIds.has(id));
    forgetHistoryOf([], [...changed, ...removed].map(({ id }) => id));
    layers.value = remote;
    for (const layer of remote) {
      handleFor(layerHandles, layer.id);
    }
    if (activeLayerId.value !== null && !remoteIds.has(activeLayerId.value)) {
      activeLayerId.value = sortedLayers.value.at(-1)?.id ?? null;
    }
  }

  /** Loads one object that changed elsewhere; a missing one was deleted. */
  async function syncObject(objectId: string): Promise<void> {
    try {
      const remote = await getObject(path, objectId);
      const existing = objects.value.find(({ id }) => id === objectId);
      if (existing === undefined) {
        objects.value = [...objects.value, remote];
        handleFor(objectHandles, remote.id);
      } else if (existing.version !== remote.version) {
        forgetHistoryOf([objectId], []);
        replaceObject(remote);
      }
    } catch (caught: unknown) {
      if (!isApiProblem(caught) || caught.status !== 404) {
        throw caught;
      }
      if (objects.value.some(({ id }) => id === objectId)) {
        forgetHistoryOf([objectId], []);
        objects.value = objects.value.filter(({ id }) => id !== objectId);
        if (selectedId.value === objectId) {
          selectedId.value = null;
        }
      }
    }
  }

  /** Layers changed elsewhere; deleting a layer also deletes its objects. */
  async function syncLayers(): Promise<void> {
    const remote = await listLayers(path);
    const remoteIds = new Set(remote.map(({ id }) => id));
    const layerRemoved = layers.value.some(({ id }) => !remoteIds.has(id));
    mergeLayers(remote);
    if (layerRemoved) {
      mergeObjects(await listObjects(path));
    }
  }

  /** Brings everything up to date without discarding undo steps for unchanged entities. */
  async function syncAll(): Promise<void> {
    const [remotePackage, remoteLayers, remoteObjects, remoteContents] = await Promise.all([
      getDataPackage(path),
      listLayers(path),
      listObjects(path),
      listContents(path),
    ]);
    dataPackage.value = remotePackage;
    mergeLayers(remoteLayers);
    mergeObjects(remoteObjects);
    contents.value = remoteContents;
  }

  /** Applies a change another tab or person saved, loading only what it touched. */
  async function applyRemoteChange(change: RemotePackageChange): Promise<void> {
    if (change.path === "objects/batch") { await syncAll(); return; }
    const objectId = OBJECT_PATH.exec(change.path)?.[1] ?? (change.path === "objects" ? change.createdId : null);
    if (objectId !== null) {
      await syncObject(objectId);
    } else if (LAYER_PATH.test(change.path)) {
      await syncLayers();
    } else if (change.path.startsWith("contents")) {
      contents.value = await listContents(path);
    } else if (PACKAGE_DETAILS_PATH.test(change.path)) {
      dataPackage.value = await getDataPackage(path);
    } else {
      // Imports and other bulk changes.
      await syncAll();
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
    contents,
    loadState,
    saveState,
    selectedId,
    selectedIds,
    selectedObjects,
    selectObjects,
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
    applyRemoteChange,
    syncAll,
    addObject,
    changeObject,
    changeObjects,
    removeObjects,
    styleObjects,
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
    changeContent,
    removeContent,
  };
}

export type PackageEditor = ReturnType<typeof usePackageEditor>;
