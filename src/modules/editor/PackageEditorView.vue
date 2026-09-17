<script setup lang="ts">
import { mdiArrowLeft, mdiCloudCheckOutline, mdiCloudUploadOutline, mdiDownload, mdiPublish, mdiUpload } from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { getEvent, type EventDto } from "@/modules/events/events.api";
import {
  downloadAtak,
  exportDraftGeoJson,
  importAtak,
  importGeoJson,
  publishDataPackage,
  type ImportReport,
  type PackageGeometry,
  type PackageLayerDto,
} from "@/modules/data-packages/data-packages.api";
import { isApiProblem } from "@/shared/errors/api-problem";
import EditorContextMenu, { type ContextTarget } from "./components/EditorContextMenu.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import ImportReportDialog from "./components/ImportReportDialog.vue";
import LayerPanel, { type LayerExportFormat } from "./components/LayerPanel.vue";
import PackageMapView from "./components/PackageMapView.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import type { EditorTool } from "./map/package-map";
import { usePackageEditor } from "./usePackageEditor";

const route = useRoute();
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

function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
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

/** ATAK receives published revisions only, never the draft. */
async function exportAtak(layer?: PackageLayerDto): Promise<void> {
  const revision = editor.dataPackage.value?.latestRevision;
  if (revision === null || revision === undefined) {
    toast.info("Publish the data package first; ATAK packages are built from published revisions.");
    return;
  }
  try {
    const { blob, fileName } = await downloadAtak(editor.path, revision, layer?.id);
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    // A layer created after the last publish is not in that revision yet.
    toast.error(isApiProblem(caught, "NOT_FOUND") ? "Publish first: this layer is not in the latest revision." : caught);
  }
}

function exportLayer(layer: PackageLayerDto, format: LayerExportFormat): void {
  void (format === "atak" ? exportAtak(layer) : exportDraft(layer));
}

function importInto(layer: PackageLayerDto): void {
  editor.activeLayerId.value = layer.id;
  fileInput.value?.click();
}

/** After a finished drawing the editor returns to selecting, so the new object can be adjusted. */
async function onDrawn(geometry: PackageGeometry): Promise<void> {
  tool.value = "select";
  await editor.addObject(geometry);
}

const SHORTCUTS: Record<string, EditorTool> = { s: "select", m: "point", l: "line", a: "polygon", c: "circle" };

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
    if (onClipboardKey(keyEvent)) {
      keyEvent.preventDefault();
    }
    return;
  }
  const shortcut = SHORTCUTS[keyEvent.key.toLowerCase()];
  if (shortcut !== undefined && (editable.value || shortcut === "select")) {
    tool.value = shortcut;
  } else if (keyEvent.key === "Escape") {
    tool.value = "select";
  } else if ((keyEvent.key === "Delete" || keyEvent.key === "Backspace") && editable.value && editor.selectedId.value !== null) {
    void editor.removeObject(editor.selectedId.value);
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

onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="editor-shell">
    <div class="editor-header d-flex align-center ga-3 px-4 py-2">
      <v-btn
        :icon="mdiArrowLeft"
        variant="text"
        aria-label="Back to the event"
        :to="{ name: 'event-detail', params: { eventId } }"
      />
      <div class="flex-grow-1" style="min-width: 0">
        <div class="text-h6 text-truncate">{{ editor.dataPackage.value?.name ?? "Data package" }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ event?.name }} ·
          {{ editor.dataPackage.value?.latestRevision ? `Revision ${editor.dataPackage.value.latestRevision} published` : "Not published yet" }}
        </div>
      </div>
      <v-chip :color="saveLabel.color" :prepend-icon="saveLabel.icon" size="small" variant="tonal" role="status">
        {{ saveLabel.text }}
      </v-chip>
      <input ref="fileInput" type="file" accept=".zip,.cot,.xml,.geojson,.json" hidden @change="onFileChosen">
      <v-btn v-if="editable" variant="text" :prepend-icon="mdiUpload" :loading="importing" @click="fileInput?.click()">Import</v-btn>
      <v-menu>
        <template #activator="{ props: menu }">
          <v-btn v-bind="menu" variant="text" :prepend-icon="mdiDownload">Export</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item title="ATAK Data Package (.zip)" :subtitle="revisionLabel" @click="exportAtak()" />
          <v-list-item title="GeoJSON of the draft" @click="exportDraft()" />
        </v-list>
      </v-menu>
      <v-btn v-if="canPublish" color="primary" :prepend-icon="mdiPublish" :loading="publishing" @click="publish">Publish</v-btn>
    </div>

    <ErrorState v-if="editor.loadState.value === 'error'" class="ma-6" message="The data package could not be loaded." @retry="editor.load" />
    <v-progress-linear v-else-if="editor.loadState.value === 'loading'" indeterminate />

    <div v-if="editor.loadState.value === 'ready'" class="editor-body">
      <aside class="editor-panel">
        <LayerPanel
          :layers="editor.sortedLayers.value"
          :objects="editor.objects.value"
          :active-layer-id="editor.activeLayerId.value"
          :selected-id="editor.selectedId.value"
          :editable="editable"
          @activate="editor.activeLayerId.value = $event"
          @select="editor.selectedId.value = $event"
          @add="editor.addLayer"
          @change="editor.changeLayer"
          @move="editor.moveLayer"
          @reorder="editor.reorderLayer"
          @move-object="editor.moveObjectToLayer"
          @import-into="importInto"
          @export-layer="exportLayer"
          @remove="editor.removeLayer"
        />
      </aside>

      <main class="editor-map">
        <PackageMapView
          ref="mapView"
          :layers="editor.layers.value"
          :objects="editor.objects.value"
          :selected-id="editor.selectedId.value"
          :tool="tool"
          @drawn="onDrawn"
          @modified="(id, geometry) => editor.changeObject(id, { geometry })"
          @select="editor.selectedId.value = $event"
          @contextmenu="contextTarget = $event"
        />
        <EditorToolbar v-model:tool="tool" :editable="editable" class="editor-toolbar-position" @fit="mapView?.fitToContent()" />
      </main>

      <aside class="editor-panel">
        <ObjectInspector
          v-if="editor.selected.value"
          :object="editor.selected.value"
          :layers="editor.sortedLayers.value"
          :editable="editable"
          @change="editor.changeObject(editor.selected.value.id, $event)"
          @duplicate="editor.duplicateObject(editor.selected.value.id)"
          @remove="editor.removeObject(editor.selected.value.id)"
        />
        <div v-else class="pa-4 text-body-2 text-medium-emphasis">
          Select an object on the map or in the list to edit it. Draw markers, lines, areas and circles with the tools on the left of the map.
        </div>
      </aside>
    </div>

    <ImportReportDialog v-model="reportOpen" :report="report" />

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
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  min-height: 0;
}
.editor-panel {
  overflow-y: auto;
  min-height: 0;
}
.editor-panel:first-child {
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.editor-panel:last-child {
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.editor-map {
  position: relative;
  min-height: 0;
}
.editor-toolbar-position {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
}
/* Tablets: narrower side panels; phones are out of scope for authoring (WEB.md). */
@media (max-width: 1100px) {
  .editor-body {
    grid-template-columns: 220px 1fr 260px;
  }
}
</style>
