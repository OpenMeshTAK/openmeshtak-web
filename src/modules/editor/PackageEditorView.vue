<script setup lang="ts">
import { DEFAULT_GRID_SETTINGS } from "./map/mgrs-grid";
import { saveFile } from "@/shared/files/save-file";
import { mdiArrowLeft, mdiChevronDown, mdiCloudCheckOutline, mdiCloudUploadOutline, mdiDownload, mdiPublish, mdiUpload } from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { getEvent, type EventDto } from "@/modules/events/events.api";
import {
  getPresentationReport,
  type PresentationReport,
  downloadAtak,
  downloadDraftKml,
  exportDraftGeoJson,
  importAtak,
  importGeoJson,
  publishDataPackage,
  type ImportReport,
  type PackageGeometry,
  type PackageLayerDto,
  type DataPackageDto,
} from "@/modules/data-packages/data-packages.api";
import CreatePackageCopyDialog from "@/modules/data-packages/components/CreatePackageCopyDialog.vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import EditorContextMenu, { type ContextTarget } from "./components/EditorContextMenu.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import PresentationReportDialog from "./components/PresentationReportDialog.vue";
import ImportReportDialog from "./components/ImportReportDialog.vue";
import LayerPanel, { type LayerExportFormat } from "./components/LayerPanel.vue";
import PackageMapView from "./components/PackageMapView.vue";
import { mapContentItems } from "./map/map-content";
import ObjectInspector from "./components/ObjectInspector.vue";
import BulkObjectInspector from "./components/BulkObjectInspector.vue";
import { iconLibraries } from "./icon-libraries.api";
import type { EditorTool } from "./map/package-map";
import { readLayersOpen, storeLayersOpen } from "./editor-preferences";
import EditorPresence from "./components/EditorPresence.vue";
import { usePackageChangeSync, type PackageChangeNotice } from "./usePackageChangeSync";
import { usePackageEditor } from "./usePackageEditor";

const presentationReport = ref<PresentationReport | null>(null);

const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();
const eventId = String(route.params.eventId);
const editor = usePackageEditor(eventId, String(route.params.packageId));

const event = ref<EventDto | null>(null);
const tool = ref<EditorTool>("select");
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const publishing = ref(false);
const importing = ref(false);
const report = ref<ImportReport | null>(null);
const reportOpen = ref(false);
const contextTarget = ref<ContextTarget | null>(null);
const layersOpen = ref(readLayersOpen());
const copyLayerTarget = ref<PackageLayerDto | null>(null);
const copyLayerOpen = ref(false);

function toggleLayers(): void {
  layersOpen.value = !layersOpen.value;
  storeLayersOpen(layersOpen.value);
}
const contextObject = computed(
  () => editor.objects.value.find(({ id }) => id === contextTarget.value?.objectId) ?? null,
);

const editable = computed(() => event.value?.status !== "archived" && session.can("data-packages.edit", eventId));
const canPublish = computed(() => event.value?.status !== "archived" && session.can("data-packages.publish", eventId));

const revisionLabel = computed(() => {
  const revision = editor.dataPackage.value?.latestRevision;
  return revision ? `Revision ${String(revision)}` : "Publish first";
});

const saveLabel = computed(() => {
  switch (editor.saveState.value) {
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

async function publish(): Promise<void> {
  publishing.value = true;
  try {
    const result = await publishDataPackage(editor.path);
    if (result.created) {
      toast.success(`Published revision ${String(result.revision.number)}.`);
    } else {
      toast.info(`Nothing changed since revision ${String(result.revision.number)}.`);
    }
    if (editor.dataPackage.value !== null) {
      editor.dataPackage.value = { ...editor.dataPackage.value, latestRevision: result.revision.number };
    }
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    publishing.value = false;
  }
}

/** GeoJSON is sent as JSON; ATAK packages (.zip) and CoT files are uploaded as they are. */
async function convertAndImport(file: File, layerId: string): Promise<ImportReport | null> {
  if (!/\.(geo)?json$/i.test(file.name)) {
    return importAtak(editor.path, layerId, file);
  }
  let document: unknown;
  try {
    document = JSON.parse(await file.text());
  } catch {
    toast.error(`${file.name} is not valid JSON.`);
    return null;
  }
  return importGeoJson(editor.path, layerId, document as { type: string });
}

/** Core converts, validates and reports every item of the file. */
async function importFile(file: File): Promise<void> {
  const layer = editor.activeLayer.value;
  if (layer === null || layer.locked) {
    toast.warning("Choose an unlocked layer before importing.");
    return;
  }
  importing.value = true;
  try {
    const result = await convertAndImport(file, layer.id);
    if (result === null) {
      return;
    }
    report.value = result;
    reportOpen.value = true;
    await editor.load();
    mapView.value?.fitToContent();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    importing.value = false;
  }
}

function onFileChosen(changeEvent: Event): void {
  const input = changeEvent.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file !== undefined) {
    void importFile(file);
  }
}

function fileNameOf(name: string): string {
  return name.replace(/[^\w-]+/g, "_");
}

/** The draft as GeoJSON, optionally only one layer. */
async function exportDraft(layer?: PackageLayerDto): Promise<void> {
  try {
    const collection = await exportDraftGeoJson(editor.path, layer?.id);
    const name = fileNameOf([editor.dataPackage.value?.name ?? "data-package", layer?.name].filter(Boolean).join("-"));
    saveFile(new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" }), `${name}.geojson`);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

/** The draft as KML for GIS tools, optionally only one layer. */
async function exportKml(layer?: PackageLayerDto): Promise<void> {
  try {
    const report = await getPresentationReport(editor.path, "kml", undefined, layer?.id);
    const { blob, fileName } = await downloadDraftKml(editor.path, layer?.id);
    presentationReport.value = report;
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

/** ATAK receives published revisions only, never the draft. */
async function exportAtak(layer?: PackageLayerDto): Promise<void> {
  const revision = editor.dataPackage.value?.latestRevision;
  if (revision === null || revision === undefined) {
    toast.info("Publish the data package first; ATAK packages are built from published revisions.");
    return;
  }
  try {
    const report = await getPresentationReport(editor.path, "cot", revision, layer?.id);
    const { blob, fileName } = await downloadAtak(editor.path, revision, layer?.id);
    presentationReport.value = report;
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    // A layer created after the last publish is not in that revision yet.
    toast.error(isApiProblem(caught, "NOT_FOUND") ? "Publish first: this layer is not in the latest revision." : caught);
  }
}

function exportLayer(layer: PackageLayerDto, format: LayerExportFormat): void {
  void (format === "atak" ? exportAtak(layer) : format === "kml" ? exportKml(layer) : exportDraft(layer));
}

function importInto(layer: PackageLayerDto): void {
  editor.activeLayerId.value = layer.id;
  fileInput.value?.click();
}

function copyLayer(layer: PackageLayerDto): void {
  copyLayerTarget.value = layer;
  copyLayerOpen.value = true;
}

function openCopiedPackage(created: DataPackageDto): void {
  toast.success(`Editable data package ${created.name} was created.`);
  void router.push({ name: "package-editor", params: { eventId, packageId: created.id } });
}

/** After a finished drawing the editor returns to selecting, so the new object can be adjusted. */
async function onDrawn(geometry: PackageGeometry): Promise<void> {
  const presentation = tool.value === "arrow" ? true : tool.value === "sector" || tool.value === "range-bearing" || tool.value === "range-circle" || tool.value === "bullseye" ? tool.value : false;
  tool.value = "select";
  await editor.addObject(geometry, presentation);
}

const SHORTCUTS: Record<string, EditorTool> = { s: "select", m: "point", l: "line", d: "arrow", v: "sector", b: "range-bearing", n: "measure-bearing", f: "freehand", a: "polygon", c: "circle", r: "rectangle", e: "ellipse", t: "route", q: "measure-length", w: "measure-area" };

/** Keyboard shortcuts, ignored while typing in a field. */
/** Copy and paste of map objects; ignored while typing so text fields keep their own clipboard. */
function onClipboardKey(keyEvent: KeyboardEvent): boolean {
  const key = keyEvent.key.toLowerCase();
  if (key === "c" && editor.selectedId.value !== null) {
    editor.copySelected();
    return true;
  }
  if (key === "v" && editable.value && editor.clipboard.value !== null) {
    void editor.paste(mapView.value?.pointerPosition() ?? null);
    return true;
  }
  return false;
}

function onKeydown(keyEvent: KeyboardEvent): void {
  const target = keyEvent.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable]") || keyEvent.altKey) {
    return;
  }
  if (keyEvent.ctrlKey || keyEvent.metaKey) {
    const key = keyEvent.key.toLowerCase();
    if (key === "z" && editable.value) {
      void (keyEvent.shiftKey ? editor.redo() : editor.undo());
      keyEvent.preventDefault();
    } else if (key === "y" && editable.value) {
      void editor.redo();
      keyEvent.preventDefault();
    } else if (onClipboardKey(keyEvent)) {
      keyEvent.preventDefault();
    }
    return;
  }
  const shortcut = SHORTCUTS[keyEvent.key.toLowerCase()];
  if (shortcut !== undefined && (editable.value || ["select", "measure-length", "measure-area", "measure-bearing"].includes(shortcut))) {
    tool.value = shortcut;
  } else if (keyEvent.key === "Escape") {
    tool.value = "select";
    editor.selectedId.value = null;
  } else if ((keyEvent.key === "Delete" || keyEvent.key === "Backspace") && editable.value && editor.selectedId.value !== null) {
    void (editor.selectedIds.value.length > 1 ? editor.removeObjects(editor.selectedIds.value) : editor.removeObject(editor.selectedId.value));
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  try {
    event.value = await getEvent(eventId);
  } catch {
    // The editor load below reports access problems.
  }
  await editor.load();
});

// Live collaboration: changes others save to this package are applied per object or layer once
// this tab's own saves are done, so the undo history stays. Others' selections show on the map.
let changeTimer: ReturnType<typeof setTimeout> | undefined;
let pendingChanges: PackageChangeNotice[] = [];
let catchUpPending = false;

function applyWhenIdle(): void {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    if (editor.saveState.value === "saving") {
      applyWhenIdle();
      return;
    }
    const changes = pendingChanges;
    const catchUp = catchUpPending;
    pendingChanges = [];
    catchUpPending = false;
    void (async () => {
      try {
        if (catchUp) {
          await editor.syncAll();
        }
        for (const change of changes) {
          await editor.applyRemoteChange(change);
        }
      } catch (caught: unknown) {
        toast.error(caught);
      }
    })();
  }, 150);
}

const packageSync = usePackageChangeSync(
  eventId,
  (change) => {
    if (change.packageId === editor.path.packageId) {
      pendingChanges.push(change);
      applyWhenIdle();
    }
  },
  () => {
    catchUpPending = true;
    applyWhenIdle();
  },
);
const otherEditors = computed(() => packageSync.others.value.filter(({ packageId }) => packageId === editor.path.packageId));
const remoteSelections = computed(() =>
  otherEditors.value.flatMap(({ objectId, color, name }) => (objectId === null ? [] : [{ objectId, color, name }])),
);
function objectNameOf(objectId: string): string | null {
  return editor.objects.value.find(({ id }) => id === objectId)?.name ?? null;
}
watch(editor.selectedId, (objectId) => packageSync.reportSelection(editor.path.packageId, objectId), { immediate: true });
onMounted(packageSync.start);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  packageSync.stop();
  clearTimeout(changeTimer);
});
</script>

<template>
  <PresentationReportDialog :report="presentationReport" />
  <div class="editor-shell">
    <div class="editor-header d-flex align-center ga-3 px-4 py-2">
      <v-btn
        :icon="mdiArrowLeft"
        variant="text"
        aria-label="Back to the event"
        :to="{ name: 'event-detail', params: { eventId, tab: 'data-packages' } }"
      />
      <div class="flex-grow-1" style="min-width: 0">
        <div class="text-title-large font-weight-medium text-truncate">{{ editor.dataPackage.value?.name ?? "Data package" }}</div>
        <div class="text-body-small text-medium-emphasis">
          {{ event?.name }} ·
          {{ editor.dataPackage.value?.latestRevision ? `Revision ${editor.dataPackage.value.latestRevision} published` : "Not published yet" }}
        </div>
      </div>
      <EditorPresence :editors="otherEditors" :object-name="objectNameOf" />
      <v-chip :color="saveLabel.color" :prepend-icon="saveLabel.icon" size="small" variant="tonal" role="status">
        {{ saveLabel.text }}
      </v-chip>
      <input ref="fileInput" type="file" accept=".zip,.cot,.xml,.geojson,.json" hidden @change="onFileChosen">
      <v-menu location="bottom end">
        <template #activator="{ props: menu }">
          <v-btn v-bind="menu" variant="text" class="text-none" :append-icon="mdiChevronDown" :loading="importing">File</v-btn>
        </template>
        <v-list density="compact" slim rounded="lg" min-width="260" class="pa-1">
          <template v-if="editable">
            <v-list-item :prepend-icon="mdiUpload" title="Import into active layer" subtitle="ATAK package, CoT or GeoJSON" @click="fileInput?.click()" />
            <v-divider class="my-1" />
          </template>
          <v-list-item :prepend-icon="mdiDownload" title="Export ATAK Data Package" :subtitle="revisionLabel" @click="exportAtak()" />
          <v-list-item :prepend-icon="mdiDownload" title="Export draft as GeoJSON" @click="exportDraft()" />
          <v-list-item :prepend-icon="mdiDownload" title="Export draft as KML" @click="exportKml()" />
        </v-list>
      </v-menu>
      <v-btn v-if="canPublish" color="primary" :prepend-icon="mdiPublish" :loading="publishing" @click="publish">Publish</v-btn>
    </div>

    <ErrorState v-if="editor.loadState.value === 'error'" class="ma-6" message="The data package could not be loaded." @retry="editor.load" />
    <v-progress-linear v-else-if="editor.loadState.value === 'loading'" indeterminate />

    <!-- The map always fills the body; both panels float over it, so it never changes size. -->
    <main v-if="editor.loadState.value === 'ready'" class="editor-body">
      <PackageMapView
        ref="mapView"
        :layers="editor.layers.value"
        :objects="editor.objects.value"
        :contents="mapContentItems(editor.path, editor.contents.value)"
        :icon-libraries="iconLibraries(editor.path, editor.contents.value)"
        :selected-id="editor.selectedId.value"
        :selected-ids="editor.selectedIds.value"
        :remote-selections="remoteSelections"
        :tool="tool"
        :editable="editable"
        @drawn="onDrawn"
        @modified="(id, geometry) => editor.changeObject(id, { geometry })"
        @styled="(id, style) => editor.changeObject(id, { style })"
        @modified-many="editor.changeObjects"
        @select-many="editor.selectObjects"
        @select="editor.selectedId.value = $event"
        @contextmenu="contextTarget = $event"
      />

      <v-sheet v-if="layersOpen" elevation="4" rounded="lg" class="editor-floating editor-layers">
        <LayerPanel
          :package-id="editor.path.packageId"
          :layers="editor.sortedLayers.value"
          :objects="editor.objects.value"
          :contents="editor.contents.value"
          :active-layer-id="editor.activeLayerId.value"
          :selected-id="editor.selectedId.value"
          :editable="editable"
          :can-copy="editable"
          @activate="editor.activeLayerId.value = $event"
          @select="editor.selectedId.value = $event"
          @add="editor.addLayer"
          @change="editor.changeLayer"
          @move="editor.moveLayer"
          @reorder="editor.reorderLayer"
          @move-object="editor.moveObjectToLayer"
          @import-into="importInto"
          @export-layer="exportLayer"
          @copy-layer="copyLayer"
          @remove="editor.removeLayer"
          @change-content="editor.changeContent"
          @remove-content="editor.removeContent"
          @zoom-to-content="mapView?.zoomToContent($event)"
        />
      </v-sheet>

      <EditorToolbar
        v-model:tool="tool"
        :editable="editable"
        :layers-open="layersOpen"
        :base-maps="mapView?.baseMaps ?? []"
        :base-map-id="mapView?.activeBaseMapId ?? ''"
        :can-undo="editor.canUndo.value"
        :can-redo="editor.canRedo.value"
        :undo-label="editor.undoLabel.value"
        :redo-label="editor.redoLabel.value"
        class="editor-toolbar-position"
        :class="{ 'editor-toolbar-position--beside': layersOpen }"
        :distance-unit="mapView?.measurementUnit ?? 'm'"
        :grid-visible="mapView?.gridVisible ?? false"
        :grid-settings="mapView?.gridSettings ?? DEFAULT_GRID_SETTINGS"
        @undo="editor.undo"
        @redo="editor.redo"
        @fit="mapView?.fitToContent()"
        @clear-measurements="mapView?.clearMeasurements()"
        @change-base-map="mapView?.selectBaseMap($event)"
        @change-distance-unit="mapView?.setMeasurementUnit($event)"
        @toggle-layers="toggleLayers"
        @toggle-grid="mapView?.setGridVisible(!(mapView?.gridVisible ?? false))"
        @change-grid-settings="mapView?.setGridSettings($event)"
      />

      <v-sheet v-if="editor.selected.value" elevation="4" rounded="lg" class="editor-floating editor-inspector">
        <BulkObjectInspector v-if="editor.selectedObjects.value.length > 1" :objects="editor.selectedObjects.value" :layers="editor.layers.value" :editable="editable" :saving="editor.saveState.value === 'saving'" @style="editor.styleObjects(editor.selectedIds.value, $event)" @remove="editor.removeObjects(editor.selectedIds.value)" />
        <ObjectInspector
          v-else
          :object="editor.selected.value"
          :event-id="eventId"
          :contents="editor.contents.value"
          :layers="editor.sortedLayers.value"
          :editable="editable"
          @change="editor.changeObject(editor.selected.value.id, $event)"
          @duplicate="editor.duplicateObject(editor.selected.value.id)"
          @remove="editor.removeObject(editor.selected.value.id)"
        />
      </v-sheet>
    </main>

    <ImportReportDialog v-model="reportOpen" :report="report" />

    <CreatePackageCopyDialog
      v-if="copyLayerTarget"
      v-model="copyLayerOpen"
      source="draft"
      :event-id="eventId"
      :default-name="`${editor.dataPackage.value?.name ?? 'Data package'} - ${copyLayerTarget.name}`"
      :source-label="`layer ${copyLayerTarget.name}`"
      :selection="[{ packageId: editor.path.packageId, layerIds: [copyLayerTarget.id] }]"
      @created="openCopiedPackage"
    />

    <EditorContextMenu
      :target="contextTarget"
      :object="contextObject"
      :layers="editor.sortedLayers.value"
      :editable="editable"
      :can-paste="editor.clipboard.value !== null"
      @close="contextTarget = null"
      @copy="editor.copySelected()"
      @duplicate="contextObject && editor.duplicateObject(contextObject.id)"
      @remove="contextObject && editor.removeObject(contextObject.id)"
      @move-to="(layerId) => contextObject && editor.moveObjectToLayer(contextObject.id, layerId)"
      @paste="(position) => editor.paste(position)"
      @add-marker="(position) => editor.addObject({ type: 'Point', coordinates: position })"
    />
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.editor-header {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.editor-body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.editor-floating {
  position: absolute;
  top: 12px;
  bottom: 12px;
  overflow-y: auto;
  z-index: 1;
}
.editor-layers {
  left: 12px;
  width: 300px;
}
.editor-inspector {
  right: 12px;
  width: 320px;
}
.editor-toolbar-position {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
}
.editor-toolbar-position--beside {
  left: calc(12px + 300px + 12px);
}
/* Tablets: narrower panels; authoring targets desktop and tablet, not phones. */
@media (max-width: 1100px) {
  .editor-layers {
    width: 240px;
  }
  .editor-toolbar-position--beside {
    left: calc(12px + 240px + 12px);
  }
  .editor-inspector {
    width: 280px;
  }
}
</style>
