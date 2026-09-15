<script setup lang="ts">
import { mdiArrowLeft, mdiCloudCheckOutline, mdiCloudUploadOutline, mdiDownload, mdiPublish, mdiUpload } from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { getEvent, type EventDto } from "@/modules/events/events.api";
import { exportDraftGeoJson, importGeoJson, publishMission, type ImportReport } from "@/modules/missions/missions.api";
import EditorToolbar from "./components/EditorToolbar.vue";
import ImportReportDialog from "./components/ImportReportDialog.vue";
import LayerPanel from "./components/LayerPanel.vue";
import MissionMapView from "./components/MissionMapView.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import type { EditorTool } from "./map/mission-map";
import { useMissionEditor } from "./useMissionEditor";

const route = useRoute();
const session = useSession();
const toast = useToast();
const eventId = String(route.params.eventId);
const editor = useMissionEditor(eventId, String(route.params.missionId));

const event = ref<EventDto | null>(null);
const tool = ref<EditorTool>("select");
const mapView = ref<InstanceType<typeof MissionMapView> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const publishing = ref(false);
const importing = ref(false);
const report = ref<ImportReport | null>(null);
const reportOpen = ref(false);

const editable = computed(() => event.value?.status !== "archived" && session.can("missions.edit", eventId));
const canPublish = computed(() => event.value?.status !== "archived" && session.can("missions.publish", eventId));

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
    const result = await publishMission(editor.path);
    if (result.created) {
      toast.success(`Published revision ${String(result.revision.number)}.`);
    } else {
      toast.info(`Nothing changed since revision ${String(result.revision.number)}.`);
    }
    if (editor.mission.value !== null) {
      editor.mission.value = { ...editor.mission.value, latestRevision: result.revision.number };
    }
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    publishing.value = false;
  }
}

/** Reads a local GeoJSON file; Core converts, validates and reports every feature. */
async function importFile(file: File): Promise<void> {
  const layer = editor.activeLayer.value;
  if (layer === null || layer.locked) {
    toast.warning("Choose an unlocked layer before importing.");
    return;
  }
  let document: unknown;
  try {
    document = JSON.parse(await file.text());
  } catch {
    toast.error(`${file.name} is not valid JSON.`);
    return;
  }
  importing.value = true;
  try {
    report.value = await importGeoJson(editor.path, layer.id, document as { type: string });
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

async function exportDraft(): Promise<void> {
  try {
    const collection = await exportDraftGeoJson(editor.path);
    const url = URL.createObjectURL(new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(editor.mission.value?.name ?? "mission").replace(/[^\w-]+/g, "_")}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

const SHORTCUTS: Record<string, EditorTool> = { s: "select", m: "point", l: "line", a: "polygon" };

/** Keyboard shortcuts, ignored while typing in a field. */
function onKeydown(keyEvent: KeyboardEvent): void {
  const target = keyEvent.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable]") || keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey) {
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
        <div class="text-h6 text-truncate">{{ editor.mission.value?.name ?? "Mission" }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ event?.name }} ·
          {{ editor.mission.value?.latestRevision ? `Revision ${editor.mission.value.latestRevision} published` : "Not published yet" }}
        </div>
      </div>
      <v-chip :color="saveLabel.color" :prepend-icon="saveLabel.icon" size="small" variant="tonal" role="status">
        {{ saveLabel.text }}
      </v-chip>
      <input ref="fileInput" type="file" accept=".geojson,.json,application/geo+json,application/json" hidden @change="onFileChosen">
      <v-btn v-if="editable" variant="text" :prepend-icon="mdiUpload" :loading="importing" @click="fileInput?.click()">Import</v-btn>
      <v-btn variant="text" :prepend-icon="mdiDownload" @click="exportDraft">Export</v-btn>
      <v-btn v-if="canPublish" color="primary" :prepend-icon="mdiPublish" :loading="publishing" @click="publish">Publish</v-btn>
    </div>

    <ErrorState v-if="editor.loadState.value === 'error'" class="ma-6" message="The mission could not be loaded." @retry="editor.load" />
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
          @remove="editor.removeLayer"
        />
      </aside>

      <main class="editor-map">
        <MissionMapView
          ref="mapView"
          :layers="editor.layers.value"
          :objects="editor.objects.value"
          :selected-id="editor.selectedId.value"
          :tool="tool"
          @drawn="editor.addObject"
          @modified="(id, geometry) => editor.changeObject(id, { geometry })"
          @select="editor.selectedId.value = $event"
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
          Select an object on the map or in the list to edit it. Draw with the tools on the left of the map.
        </div>
      </aside>
    </div>

    <ImportReportDialog v-model="reportOpen" :report="report" />
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
