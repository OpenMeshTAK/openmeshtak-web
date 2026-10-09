<script setup lang="ts">
import { mdiBookshelf, mdiContentSaveOutline, mdiDownload, mdiFileImportOutline } from "@mdi/js";
import { computed, ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import SettingsRow from "@/shared/settings/SettingsRow.vue";
import MeshtasticPresetImportDialog from "./MeshtasticPresetImportDialog.vue";
import { downloadPreset, KIND_LABELS, readPresetFile } from "./preset-file";
import SavePresetDialog from "./SavePresetDialog.vue";
import TakPresetImportDialog from "./TakPresetImportDialog.vue";
import { exportPreset, getPreset, listPresets, type PresetDocumentDto, type PresetKind, type SettingsPresetSummaryDto } from "./settings-presets.api";

/**
 * Export and import of the event's TAK or Meshtastic settings as portable presets: download a JSON
 * file, save to the global library, or import a file or library preset after a preview. Imports
 * change the draft only; members get the settings once the configuration is published.
 */
const props = defineProps<{
  eventId: string;
  kind: PresetKind;
  editable: boolean;
  /** Unsaved changes would be overwritten by an import, so importing waits until they are saved. */
  dirty: boolean;
  /** Field labels by key for the Meshtastic preview. */
  labels?: Record<string, string>;
}>();
const emit = defineEmits<{ imported: [] }>();
const toast = useToast();

const label = computed(() => KIND_LABELS[props.kind]);
const fileInput = ref<HTMLInputElement | null>(null);
const exporting = ref(false);
const saveOpen = ref(false);
const saveDocument = ref<PresetDocumentDto | null>(null);
const importOpen = ref(false);
const importDocument = ref<PresetDocumentDto | null>(null);
const fileError = ref("");
const libraryOpen = ref(false);
const libraryState = ref<"loading" | "ready" | "error">("loading");
const libraryError = ref("");
const library = ref<SettingsPresetSummaryDto[]>([]);
const choosing = ref<string | null>(null);

async function download(): Promise<void> {
  exporting.value = true;
  try {
    downloadPreset(await exportPreset(props.eventId, props.kind));
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    exporting.value = false;
  }
}

async function openSave(): Promise<void> {
  try {
    saveDocument.value = await exportPreset(props.eventId, props.kind);
    saveOpen.value = true;
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

function startImport(document: PresetDocumentDto): void {
  importDocument.value = document;
  importOpen.value = true;
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  fileError.value = "";
  if (file === undefined) {
    return;
  }
  try {
    startImport(await readPresetFile(file, props.kind));
  } catch (caught: unknown) {
    fileError.value = caught instanceof Error ? caught.message : describeError(caught);
  }
}

async function openLibrary(): Promise<void> {
  libraryOpen.value = true;
  libraryState.value = "loading";
  try {
    library.value = await listPresets(props.kind);
    libraryState.value = "ready";
  } catch (caught: unknown) {
    libraryError.value = describeError(caught);
    libraryState.value = "error";
  }
}

async function choose(preset: SettingsPresetSummaryDto): Promise<void> {
  choosing.value = preset.id;
  try {
    const loaded = await getPreset(preset.id);
    libraryOpen.value = false;
    startImport(loaded.document);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    choosing.value = null;
  }
}

function imported(): void {
  toast.success(`Preset imported. Publish the configuration so members get the ${label.value} settings.`);
  emit("imported");
}
</script>

<template>
  <div>
    <v-card class="mb-4">
      <SettingsRow
        setting-id="presets:download"
        title="Download preset"
        :description="`The event's ${label} settings as an OpenMeshTak preset file (.json) for another event or installation.`"
        hint="The file never contains channel keys, passwords, PINs, certificates, tokens or member-specific settings. You can read and edit it, or hand it to an assistant for review; OpenMeshTak checks it again on import."
      >
        <v-btn variant="outlined" :prepend-icon="mdiDownload" :loading="exporting" @click="download">Download</v-btn>
      </SettingsRow>
      <v-divider />
      <SettingsRow
        setting-id="presets:save"
        title="Save to library"
        description="Keep these settings as a reusable preset that every event can import."
        hint="Events get their own copy when they import a library preset. Changing or deleting the library preset later never changes an event."
      >
        <v-btn variant="outlined" :prepend-icon="mdiContentSaveOutline" @click="openSave">Save</v-btn>
      </SettingsRow>
    </v-card>

    <v-card v-if="editable" class="mb-4">
      <SettingsRow
        setting-id="presets:import-file"
        title="Import preset file"
        :description="`Shows what would change in this event's ${label} settings before anything is imported.`"
        :error="fileError || undefined"
      >
        <v-btn variant="outlined" :prepend-icon="mdiFileImportOutline" :disabled="dirty" @click="fileInput?.click()">Import file</v-btn>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChosen">
      </SettingsRow>
      <v-divider />
      <SettingsRow setting-id="presets:import-library" title="Import from library" :description="`Apply a saved ${label} preset to this event.`">
        <v-btn variant="outlined" :prepend-icon="mdiBookshelf" :disabled="dirty" @click="openLibrary">Choose preset</v-btn>
      </SettingsRow>
      <div v-if="dirty" class="text-body-small text-medium-emphasis px-4 pb-3">Save or discard your changes before importing.</div>
    </v-card>

    <v-dialog v-model="libraryOpen" max-width="640" scrollable>
      <v-card>
        <v-card-title class="text-title-large font-weight-medium pt-4 px-6">{{ label }} presets</v-card-title>
        <v-card-text class="px-6">
          <v-skeleton-loader v-if="libraryState === 'loading'" type="list-item-two-line@3" />
          <v-alert v-else-if="libraryState === 'error'" type="error" variant="tonal">{{ libraryError }}</v-alert>
          <p v-else-if="library.length === 0" class="text-body-medium text-medium-emphasis">
            The library has no {{ label }} presets yet. Save an event's settings to the library first.
          </p>
          <v-list v-else lines="two" class="py-0">
            <v-list-item
              v-for="preset in library"
              :key="preset.id"
              :title="preset.name"
              :subtitle="[preset.description, `${preset.itemCount} settings`, preset.targetVersion].filter(Boolean).join(' · ')"
              :disabled="choosing !== null"
              @click="choose(preset)"
            >
              <template v-if="choosing === preset.id" #append><v-progress-circular indeterminate size="20" /></template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="libraryOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <SavePresetDialog v-model="saveOpen" :document="saveDocument" @saved="toast.success(`Saved “${$event.name}” to the preset library.`)" />
    <MeshtasticPresetImportDialog
      v-if="kind === 'meshtastic'"
      v-model="importOpen"
      :event-id="eventId"
      :document="importDocument"
      :labels="labels ?? {}"
      @imported="imported"
    />
    <TakPresetImportDialog v-else v-model="importOpen" :event-id="eventId" :document="importDocument" @imported="imported" />
  </div>
</template>
