<script setup lang="ts">
import { saveFile } from "@/shared/files/save-file";
import {
  mdiArrowLeft,
  mdiCloudCheckOutline,
  mdiCloudUploadOutline,
  mdiDownload,
  mdiMapPlus,
  mdiPublish,
  mdiUpload,
} from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import CreatePackageCopyDialog from "@/modules/data-packages/components/CreatePackageCopyDialog.vue";
import {
  createDataPackage,
  downloadAtak,
  downloadDraftKml,
  exportDraftGeoJson,
  importAtak,
  importGeoJson,
  listDataPackages,
  reorderDataPackages,
  publishDataPackage,
  type DataPackageDto,
  type ImportReport,
  type PackageGeometry,
  type PackageLayerDto,
  type PackageObjectDto,
} from "@/modules/data-packages/data-packages.api";
import { getEvent, type EventDto } from "@/modules/events/events.api";
import EditorContextMenu, { type ContextTarget } from "./components/EditorContextMenu.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import EventPackageTree from "./components/EventPackageTree.vue";
import ImportReportDialog from "./components/ImportReportDialog.vue";
import type { LayerExportFormat } from "./components/LayerPanel.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import PackageMapView from "./components/PackageMapView.vue";
import { topFirst } from "@/modules/data-packages/package-order";
import { mapContentItems } from "./map/map-content";
import { readLayersOpen, storeLayersOpen } from "./editor-preferences";
import type { EventPackageBranch } from "./event-editor.types";
import type { EditorTool } from "./map/package-map";
import { usePackageEditor, type PackageEditor, type SaveState } from "./usePackageEditor";

const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();
const eventId = String(route.params.eventId);

const event = ref<EventDto | null>(null);
const editors = shallowRef<PackageEditor[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const selectedId = ref<string | null>(null);
const activePackageId = ref<string | null>(null);
const tool = ref<EditorTool>("select");
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const layersOpen = ref(readLayersOpen());
const contextTarget = ref<ContextTarget | null>(null);
const clipboard = ref<PackageObjectDto | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const importTarget = shallowRef<{ editor: PackageEditor; layer: PackageLayerDto } | null>(null);
const importing = ref(false);
const report = ref<ImportReport | null>(null);
const reportOpen = ref(false);
const publishingId = ref<string | null>(null);
const copySource = ref<{ branch: EventPackageBranch; layer: PackageLayerDto } | null>(null);
const copyOpen = ref(false);
const createOpen = ref(false);
const packageName = ref("");
const creation = useSubmission();
const eventHistoryBusy = ref(false);

/** Top-first like the layer lists: the first package is drawn above the others. */
const branches = computed<EventPackageBranch[]>(() => {
  const loaded = editors.value.flatMap((editor) => {
    const dataPackage = editor.dataPackage.value;
    return dataPackage === null
      ? []
      : [{ dataPackage, layers: editor.sortedLayers.value, objects: editor.objects.value, contents: editor.contents.value }];
  });
  const order = topFirst(loaded.map(({ dataPackage }) => dataPackage)).map(({ id }) => id);
  return loaded.sort((a, b) => order.indexOf(a.dataPackage.id) - order.indexOf(b.dataPackage.id));
}
);
const layers = computed(() => branches.value.flatMap(({ layers }) => layers));
/** Normalizes package-local layer numbers to the exact top-to-bottom order shown in the tree. */
const mapLayers = computed(() =>
  [...branches.value]
    .reverse()
    .flatMap(({ layers }) => layers)
    .map((layer, sortOrder) => ({ ...layer, sortOrder })),
);
const objects = computed(() => branches.value.flatMap(({ objects }) => objects));
const mapContents = computed(() => editors.value.flatMap((editor) => mapContentItems(editor.path, editor.contents.value)));
const activeEditor = computed(() => editors.value.find(({ path }) => path.packageId === activePackageId.value) ?? null);
const activeLayerId = computed(() => activeEditor.value?.activeLayerId.value ?? null);
const selected = computed(() => objects.value.find(({ id }) => id === selectedId.value) ?? null);
const selectedEditor = computed(() =>
  selected.value === null ? null : editors.value.find(({ path }) => path.packageId === selected.value?.packageId) ?? null,
);
const selectedLayers = computed(() => selectedEditor.value?.sortedLayers.value ?? []);
const contextObject = computed(() => objects.value.find(({ id }) => id === contextTarget.value?.objectId) ?? null);
const contextEditor = computed(() =>
  contextObject.value === null
    ? activeEditor.value
    : editors.value.find(({ path }) => path.packageId === contextObject.value?.packageId) ?? null,
);
const editable = computed(
  () => event.value !== null && event.value.status !== "archived" && session.can("data-packages.edit", eventId),
);
const canPublish = computed(
  () => event.value !== null && event.value.status !== "archived" && session.can("data-packages.publish", eventId),
);
const undoEditor = computed(() =>
  [...editors.value].sort((a, b) => b.undoSequence.value - a.undoSequence.value).find(({ canUndo }) => canUndo.value) ?? null,
);
const redoEditor = computed(() =>
  [...editors.value].sort((a, b) => b.redoSequence.value - a.redoSequence.value).find(({ canRedo }) => canRedo.value) ?? null,
);

function combinedSaveState(): SaveState {
  const states = editors.value.map((editor) => editor.saveState.value);
  return states.includes("saving")
    ? "saving"
    : states.includes("error")
      ? "error"
      : states.includes("conflict")
        ? "conflict"
        : "saved";
}

const saveLabel = computed(() => {
  switch (combinedSaveState()) {
    case "saving":
      return { text: "Saving…", icon: mdiCloudUploadOutline, color: "info" };
    case "error":
      return { text: "Not saved", icon: mdiCloudUploadOutline, color: "error" };
    case "conflict":
      return { text: "Reloaded after conflict", icon: mdiCloudUploadOutline, color: "warning" };
    default:
      return { text: "All changes saved", icon: mdiCloudCheckOutline, color: "success" };
  }
});

function editorFor(packageId: string): PackageEditor | null {
  return editors.value.find(({ path }) => path.packageId === packageId) ?? null;
}

function editorForObject(objectId: string): PackageEditor | null {
  return editors.value.find((editor) => editor.objects.value.some(({ id }) => id === objectId)) ?? null;
}

async function makeEditor(packageId: string): Promise<PackageEditor> {
  const editor = usePackageEditor(eventId, packageId);
  await editor.load();
  return editor;
}

/** Saves a dragged package order (top first) and applies the stored positions to the open editors. */
async function reorderPackages(topFirstIds: string[]): Promise<void> {
  try {
    const stored = await reorderDataPackages(eventId, [...topFirstIds].reverse());
    for (const editor of editors.value) {
      const fresh = stored.find(({ id }) => id === editor.path.packageId);
      if (fresh !== undefined && editor.dataPackage.value !== null) {
        editor.dataPackage.value = { ...editor.dataPackage.value, sortOrder: fresh.sortOrder };
      }
    }
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedEvent, packages] = await Promise.all([getEvent(eventId), listDataPackages(eventId)]);
    const loadedEditors = await Promise.all(packages.map(({ id }) => makeEditor(id)));
    if (loadedEditors.some(({ loadState }) => loadState.value === "error")) {
      throw new Error("One or more data packages could not be loaded.");
    }
    event.value = loadedEvent;
    editors.value = loadedEditors;
    activePackageId.value ??= loadedEditors[0]?.path.packageId ?? null;
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

function activatePackage(branch: EventPackageBranch): void {
  activePackageId.value = branch.dataPackage.id;
  editorFor(branch.dataPackage.id)!.activeLayerId.value ??= branch.layers.at(-1)?.id ?? null;
}

function activateLayer(branch: EventPackageBranch, layerId: string): void {
  activePackageId.value = branch.dataPackage.id;
  editorFor(branch.dataPackage.id)!.activeLayerId.value = layerId;
}

async function addLayer(branch: EventPackageBranch): Promise<void> {
  const editor = editorFor(branch.dataPackage.id);
  if (editor === null) {
    return;
  }
  activePackageId.value = branch.dataPackage.id;
  await editor.addLayer();
}

function selectObject(objectId: string | null): void {
  selectedId.value = objectId;
  for (const editor of editors.value) {
    editor.selectedId.value = null;
  }
  if (objectId === null) {
    return;
  }
  const editor = editorForObject(objectId);
  const object = editor?.objects.value.find(({ id }) => id === objectId);
  if (editor !== null && editor !== undefined && object !== undefined) {
    activePackageId.value = editor.path.packageId;
    editor.activeLayerId.value = object.layerId;
    editor.selectedId.value = objectId;
  }
}

async function undoLast(): Promise<void> {
  const editor = undoEditor.value;
  if (editor === null || eventHistoryBusy.value) {
    return;
  }
  eventHistoryBusy.value = true;
  try {
    activePackageId.value = editor.path.packageId;
    await editor.undo();
    selectedId.value = editor.selectedId.value;
  } finally {
    eventHistoryBusy.value = false;
  }
}

async function redoLast(): Promise<void> {
  const editor = redoEditor.value;
  if (editor === null || eventHistoryBusy.value) {
    return;
  }
  eventHistoryBusy.value = true;
  try {
    activePackageId.value = editor.path.packageId;
    await editor.redo();
    selectedId.value = editor.selectedId.value;
  } finally {
    eventHistoryBusy.value = false;
  }
}

async function createPackage(): Promise<void> {
  const created = await creation.run(() => createDataPackage(eventId, { name: packageName.value.trim() }));
  if (created !== null) {
    const editor = await makeEditor(created.value.id);
    editors.value = [...editors.value, editor];
    activePackageId.value = editor.path.packageId;
    createOpen.value = false;
    toast.success(`Data package ${created.value.name} was created.`);
  }
}

async function publish(branch: EventPackageBranch): Promise<void> {
  const editor = editorFor(branch.dataPackage.id);
  if (editor === null) {
    return;
  }
  publishingId.value = branch.dataPackage.id;
  try {
    const result = await publishDataPackage(editor.path);
    if (editor.dataPackage.value !== null) {
      editor.dataPackage.value = { ...editor.dataPackage.value, latestRevision: result.revision.number };
    }
    if (result.created) {
      toast.success(`Published ${branch.dataPackage.name} revision ${String(result.revision.number)}.`);
    } else {
      toast.info(`${branch.dataPackage.name} is unchanged since revision ${String(result.revision.number)}.`);
    }
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    publishingId.value = null;
  }
}

/** GeoJSON is JSON; ATAK packages and CoT files are uploaded as their original bytes. */
async function convertAndImport(editor: PackageEditor, file: File, layerId: string): Promise<ImportReport | null> {
  if (!/\.(geo)?json$/i.test(file.name)) {
    return importAtak(editor.path, layerId, file);
  }
  let document: { type: string };
  try {
    document = JSON.parse(await file.text()) as { type: string };
  } catch {
    toast.error(`${file.name} is not valid JSON.`);
    return null;
  }
  return importGeoJson(editor.path, layerId, document);
}

function importInto(branch: EventPackageBranch, layer: PackageLayerDto): void {
  const editor = editorFor(branch.dataPackage.id);
  if (editor === null) {
    return;
  }
  activateLayer(branch, layer.id);
  importTarget.value = { editor, layer };
  fileInput.value?.click();
}

function importIntoActive(): void {
  const editor = activeEditor.value;
  const layer = editor?.activeLayer.value;
  if (editor === null || layer === null || layer === undefined || layer.locked) {
    toast.warning("Choose an unlocked layer before importing.");
    return;
  }
  importTarget.value = { editor, layer };
  fileInput.value?.click();
}

async function onFileChosen(changeEvent: Event): Promise<void> {
  const input = changeEvent.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  const target = importTarget.value;
  importTarget.value = null;
  if (file === undefined || target === null) {
    return;
  }
  importing.value = true;
  try {
    const result = await convertAndImport(target.editor, file, target.layer.id);
    if (result !== null) {
      report.value = result;
      reportOpen.value = true;
      await target.editor.load();
      mapView.value?.fitToContent();
    }
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    importing.value = false;
  }
}

function fileNameOf(name: string): string {
  return name.replace(/[^\w-]+/g, "_");
}

async function exportDraft(editor: PackageEditor, layer?: PackageLayerDto): Promise<void> {
  try {
    const collection = await exportDraftGeoJson(editor.path, layer?.id);
    const name = fileNameOf([editor.dataPackage.value?.name ?? "data-package", layer?.name].filter(Boolean).join("-"));
    saveFile(new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" }), `${name}.geojson`);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function exportKml(editor: PackageEditor, layer?: PackageLayerDto): Promise<void> {
  try {
    const { blob, fileName } = await downloadDraftKml(editor.path, layer?.id);
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function exportAtak(editor: PackageEditor, layer?: PackageLayerDto): Promise<void> {
  const revision = editor.dataPackage.value?.latestRevision;
  if (revision === null || revision === undefined) {
    toast.info("Publish the data package first; ATAK packages are built from published revisions.");
    return;
  }
  try {
    const { blob, fileName } = await downloadAtak(editor.path, revision, layer?.id);
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    toast.error(isApiProblem(caught, "NOT_FOUND") ? "Publish first: this layer is not in the latest revision." : caught);
  }
}

function exportPackage(branch: EventPackageBranch, format: LayerExportFormat): void {
  const editor = editorFor(branch.dataPackage.id);
  if (editor !== null) {
    void (format === "atak" ? exportAtak(editor) : format === "kml" ? exportKml(editor) : exportDraft(editor));
  }
}

function exportLayer(branch: EventPackageBranch, layer: PackageLayerDto, format: LayerExportFormat): void {
  const editor = editorFor(branch.dataPackage.id);
  if (editor !== null) {
    void (format === "atak" ? exportAtak(editor, layer) : format === "kml" ? exportKml(editor, layer) : exportDraft(editor, layer));
  }
}

async function onDrawn(geometry: PackageGeometry): Promise<void> {
  tool.value = "select";
  const editor = activeEditor.value;
  if (editor !== null) {
    await editor.addObject(geometry);
    selectObject(editor.selectedId.value);
  }
}

async function addMarker(position: number[]): Promise<void> {
  const editor = activeEditor.value;
  if (editor === null) {
    return;
  }
  await editor.addObject({ type: "Point", coordinates: position });
  selectObject(editor.selectedId.value);
}

function openPackage(packageId: string): void {
  void router.push({ name: "package-editor", params: { eventId, packageId } });
}

function publishActive(): void {
  const editor = activeEditor.value;
  const dataPackage = editor?.dataPackage.value;
  if (editor !== null && editor !== undefined && dataPackage !== null && dataPackage !== undefined) {
    void publish({ dataPackage, layers: editor.sortedLayers.value, objects: editor.objects.value, contents: editor.contents.value });
  }
}

async function changeGeometry(objectId: string, geometry: PackageGeometry): Promise<void> {
  await editorForObject(objectId)?.changeObject(objectId, { geometry });
}

async function changeSelected(changes: Parameters<PackageEditor["changeObject"]>[1]): Promise<void> {
  const editor = selectedEditor.value;
  if (editor !== null && selectedId.value !== null) {
    await editor.changeObject(selectedId.value, changes);
  }
}

async function duplicateSelected(): Promise<void> {
  const editor = selectedEditor.value;
  if (editor !== null && selectedId.value !== null) {
    await editor.duplicateObject(selectedId.value);
    selectObject(editor.selectedId.value);
  }
}

async function removeSelected(): Promise<void> {
  const editor = selectedEditor.value;
  if (editor !== null && selectedId.value !== null) {
    await editor.removeObject(selectedId.value);
    selectedId.value = null;
  }
}

function copySelected(): void {
  clipboard.value = selected.value;
  if (selected.value !== null) {
    toast.info(`Copied ${selected.value.name}.`);
  }
}

async function paste(position: number[] | null): Promise<void> {
  const editor = activeEditor.value;
  if (editor === null || clipboard.value === null) {
    return;
  }
  editor.clipboard.value = clipboard.value;
  await editor.paste(position);
  selectObject(editor.selectedId.value);
}

function copyLayer(branch: EventPackageBranch, layer: PackageLayerDto): void {
  copySource.value = { branch, layer };
  copyOpen.value = true;
}

async function addCopiedPackage(created: DataPackageDto): Promise<void> {
  const editor = await makeEditor(created.id);
  editors.value = [...editors.value, editor];
  activePackageId.value = editor.path.packageId;
  copyOpen.value = false;
  toast.success(`Editable data package ${created.name} was created.`);
}

function toggleLayers(): void {
  layersOpen.value = !layersOpen.value;
  storeLayersOpen(layersOpen.value);
}

const SHORTCUTS: Record<string, EditorTool> = { s: "select", m: "point", l: "line", a: "polygon", c: "circle" };

function onKeydown(keyEvent: KeyboardEvent): void {
  const target = keyEvent.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable]") || keyEvent.altKey) {
    return;
  }
  const key = keyEvent.key.toLowerCase();
  if (keyEvent.ctrlKey || keyEvent.metaKey) {
    if (key === "z" && editable.value) {
      void (keyEvent.shiftKey ? redoLast() : undoLast());
      keyEvent.preventDefault();
    } else if (key === "y" && editable.value) {
      void redoLast();
      keyEvent.preventDefault();
    } else if (key === "c" && selectedId.value !== null) {
      copySelected();
      keyEvent.preventDefault();
    } else if (key === "v" && editable.value && clipboard.value !== null) {
      void paste(mapView.value?.pointerPosition() ?? null);
      keyEvent.preventDefault();
    }
    return;
  }
  const shortcut = SHORTCUTS[key];
  if (shortcut !== undefined && (editable.value || shortcut === "select")) {
    tool.value = shortcut;
  } else if (keyEvent.key === "Escape") {
    tool.value = "select";
    selectedId.value = null;
  } else if ((keyEvent.key === "Delete" || keyEvent.key === "Backspace") && editable.value && selectedId.value !== null) {
    void removeSelected();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  await load();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="event-editor-shell">
    <header class="event-editor-header d-flex align-center ga-3 px-4 py-2">
      <v-btn
        :icon="mdiArrowLeft"
        variant="text"
        aria-label="Back to the event"
        :to="{ name: 'event-detail', params: { eventId } }"
      />
      <div class="flex-grow-1" style="min-width: 0">
        <div class="text-h6 text-truncate">{{ event?.name ?? "Event" }} map</div>
        <div class="text-caption text-medium-emphasis">
          {{ activeEditor?.dataPackage.value?.name ?? "Choose a data package" }} ·
          {{ branches.length }} packages · {{ layers.length }} layers · {{ objects.length }} items
        </div>
      </div>
      <v-chip :color="saveLabel.color" :prepend-icon="saveLabel.icon" size="small" variant="tonal" role="status">
        {{ saveLabel.text }}
      </v-chip>
      <input ref="fileInput" type="file" accept=".zip,.cot,.xml,.geojson,.json" hidden @change="onFileChosen">
      <v-btn v-if="editable" variant="text" :prepend-icon="mdiMapPlus" @click="(packageName = ''), creation.reset(), (createOpen = true)">
        Data package
      </v-btn>
      <v-btn v-if="editable" variant="text" :prepend-icon="mdiUpload" :loading="importing" @click="importIntoActive">Import</v-btn>
      <v-menu v-if="activeEditor">
        <template #activator="{ props: menu }">
          <v-btn v-bind="menu" variant="text" :prepend-icon="mdiDownload">Export</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            title="ATAK Data Package (.zip)"
            :subtitle="activeEditor.dataPackage.value?.latestRevision ? `Revision ${activeEditor.dataPackage.value.latestRevision}` : 'Publish first'"
            @click="exportAtak(activeEditor)"
          />
          <v-list-item title="GeoJSON of the draft" @click="exportDraft(activeEditor)" />
        </v-list>
      </v-menu>
      <v-btn
        v-if="canPublish && activeEditor"
        color="primary"
        :prepend-icon="mdiPublish"
        :loading="publishingId === activeEditor.path.packageId"
        @click="publishActive"
      >
        Publish
      </v-btn>
    </header>

    <v-progress-linear v-if="state === 'loading'" indeterminate />
    <ErrorState v-else-if="state === 'error'" class="ma-6" :message="error" @retry="load" />
    <EmptyState
      v-else-if="branches.length === 0"
      class="ma-6"
      title="No data packages"
      text="Create a data package to start drawing on the event map."
    >
      <v-btn v-if="editable" color="primary" :prepend-icon="mdiMapPlus" @click="(packageName = ''), creation.reset(), (createOpen = true)">
        New data package
      </v-btn>
    </EmptyState>

    <main v-else class="event-editor-body">
      <PackageMapView
        ref="mapView"
        :layers="mapLayers"
        :objects="objects"
        :contents="mapContents"
        :selected-id="selectedId"
        :tool="tool"
        @drawn="onDrawn"
        @modified="changeGeometry"
        @select="selectObject"
        @contextmenu="contextTarget = $event"
      />

      <v-sheet v-if="layersOpen" elevation="4" rounded="lg" class="event-editor-tree">
        <EventPackageTree
          :branches="branches"
          :active-package-id="activePackageId"
          :active-layer-id="activeLayerId"
          :selected-id="selectedId"
          :editable="editable"
          :can-publish="canPublish"
          @activate-package="activatePackage"
          @activate-layer="activateLayer"
          @select="selectObject"
          @open-package="openPackage"
          @publish-package="publish"
          @export-package="exportPackage"
          @add-layer="addLayer"
          @change-layer="(branch, layer, changes) => editorFor(branch.dataPackage.id)?.changeLayer(layer, changes)"
          @move-layer="(branch, layer, direction) => editorFor(branch.dataPackage.id)?.moveLayer(layer, direction)"
          @reorder-layer="(branch, layerId, targetLayerId) => editorFor(branch.dataPackage.id)?.reorderLayer(layerId, targetLayerId)"
          @move-object="(branch, objectId, layerId) => editorFor(branch.dataPackage.id)?.moveObjectToLayer(objectId, layerId)"
          @import-into="importInto"
          @export-layer="exportLayer"
          @copy-layer="copyLayer"
          @remove-layer="(branch, layer) => editorFor(branch.dataPackage.id)?.removeLayer(layer)"
          @reorder-packages="reorderPackages"
          @change-content="(branch, contentId, changes) => editorFor(branch.dataPackage.id)?.changeContent(contentId, changes)"
          @remove-content="(branch, contentId) => editorFor(branch.dataPackage.id)?.removeContent(contentId)"
          @zoom-to-content="mapView?.zoomToContent($event)"
        />
      </v-sheet>

      <EditorToolbar
        v-model:tool="tool"
        :editable="editable && activeEditor !== null"
        :layers-open="layersOpen"
        :can-undo="undoEditor !== null && !eventHistoryBusy"
        :can-redo="redoEditor !== null && !eventHistoryBusy"
        :undo-label="undoEditor?.undoLabel.value ?? null"
        :redo-label="redoEditor?.redoLabel.value ?? null"
        class="event-editor-toolbar"
        :class="{ 'event-editor-toolbar--beside': layersOpen }"
        @undo="undoLast"
        @redo="redoLast"
        @fit="mapView?.fitToContent()"
        @toggle-layers="toggleLayers"
      />

      <v-sheet v-if="selected && selectedEditor" elevation="4" rounded="lg" class="event-editor-inspector">
        <ObjectInspector
          :object="selected"
          :layers="selectedLayers"
          :editable="editable"
          @change="changeSelected"
          @duplicate="duplicateSelected"
          @remove="removeSelected"
        />
      </v-sheet>
    </main>

    <ImportReportDialog v-model="reportOpen" :report="report" />

    <CreatePackageCopyDialog
      v-if="copySource"
      v-model="copyOpen"
      :event-id="eventId"
      :default-name="`${copySource.branch.dataPackage.name} - ${copySource.layer.name}`"
      :source-label="`layer ${copySource.layer.name}`"
      :selection="[{ packageId: copySource.branch.dataPackage.id, layerIds: [copySource.layer.id] }]"
      @created="addCopiedPackage"
    />

    <v-dialog v-model="createOpen" max-width="480">
      <v-card class="pa-2">
        <v-card-title>New data package</v-card-title>
        <v-card-text>
          <v-alert v-if="creation.error.value" type="error" class="mb-4">{{ creation.error.value }}</v-alert>
          <v-text-field
            v-model="packageName"
            label="Name"
            maxlength="100"
            autofocus
            :error-messages="messagesFor(creation.fields.value, 'name')"
            @keydown.enter="createPackage"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="creation.submitting.value" :disabled="packageName.trim() === ''" @click="createPackage">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <EditorContextMenu
      :target="contextTarget"
      :object="contextObject"
      :layers="contextEditor?.sortedLayers.value ?? []"
      :editable="editable"
      :can-paste="clipboard !== null"
      @close="contextTarget = null"
      @copy="copySelected"
      @duplicate="duplicateSelected"
      @remove="removeSelected"
      @move-to="(layerId) => contextObject && contextEditor?.moveObjectToLayer(contextObject.id, layerId)"
      @paste="(position) => paste(position)"
      @add-marker="addMarker"
    />
  </div>
</template>

<style scoped>
.event-editor-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.event-editor-header {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.event-editor-body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.event-editor-tree,
.event-editor-inspector {
  position: absolute;
  top: 12px;
  bottom: 12px;
  z-index: 1;
  overflow-y: auto;
}
.event-editor-tree {
  left: 12px;
  width: 380px;
}
.event-editor-inspector {
  right: 12px;
  width: 320px;
}
.event-editor-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
}
.event-editor-toolbar--beside {
  left: calc(12px + 380px + 12px);
}
@media (max-width: 1100px) {
  .event-editor-tree {
    width: 320px;
  }
  .event-editor-toolbar--beside {
    left: calc(12px + 320px + 12px);
  }
  .event-editor-inspector {
    width: 280px;
  }
}
</style>
