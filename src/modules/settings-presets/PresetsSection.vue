<script setup lang="ts">
import { mdiBookshelf, mdiChevronRight, mdiContentSaveOutline, mdiDownload, mdiFileUploadOutline } from "@mdi/js";
import { computed, ref } from "vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import MeshtasticPresetImportDialog from "./MeshtasticPresetImportDialog.vue";
import PresetActionTile from "./PresetActionTile.vue";
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
    <div v-if="editable" class="mb-6">
      <div class="d-flex align-center ga-1 text-title-small mb-2">
        Load a preset into this event
        <InfoHint
          label="About loading presets"
          text="You see every change before anything is applied. Loading changes the draft only; publish the configuration so members get it."
        />
      </div>
      <div class="action-grid mb-2">
        <PresetActionTile
          setting-id="presets:import-library"
          :icon="mdiBookshelf"
          title="Choose from library"
          :description="`${label} presets saved from any event`"
          :disabled="dirty"
          @click="openLibrary"
        />
        <PresetActionTile
          setting-id="presets:import-file"
          :icon="mdiFileUploadOutline"
          title="Upload a preset file"
          description="A .json preset from another event or installation"
          :disabled="dirty"
          @click="fileInput?.click()"
        />
      </div>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChosen">
      <div v-if="fileError" class="text-body-small text-error mb-2">{{ fileError }}</div>
      <div v-if="dirty" class="text-body-small text-medium-emphasis mb-2">Save or discard your changes before loading a preset.</div>
    </div>

    <div class="d-flex align-center ga-1 text-title-small mb-2">
      Reuse these settings
      <InfoHint label="About reusing settings">
        <p class="mb-2">
          A preset never contains channel keys, passwords, PINs, certificates, tokens or member-specific settings. You can read and edit
          the file, or hand it to an assistant for review; OpenMeshTak checks it again when it is loaded.
        </p>
        <p class="mb-0">Events get their own copy of a library preset, so changing or deleting it later never changes an event.</p>
      </InfoHint>
    </div>
    <div class="action-grid mb-6">
      <PresetActionTile
        setting-id="presets:save"
        :icon="mdiContentSaveOutline"
        title="Save to library"
        description="Every event can then load it"
        @click="openSave"
      />
      <PresetActionTile
        setting-id="presets:download"
        :icon="mdiDownload"
        title="Download as file"
        description="A .json preset for another installation"
        :loading="exporting"
        @click="download"
      />
    </div>

    <v-dialog v-model="libraryOpen" max-width="640" scrollable>
      <v-card>
        <v-card-title class="text-title-large font-weight-medium pt-5 px-6 pb-1">Import {{ label }} preset</v-card-title>
        <div class="text-body-medium text-medium-emphasis px-6">Choose a preset. You see what would change before anything is imported.</div>
        <v-card-text class="px-6 pt-4">
          <v-skeleton-loader v-if="libraryState === 'loading'" type="list-item-two-line@3" />
          <v-alert v-else-if="libraryState === 'error'" type="error" variant="tonal">{{ libraryError }}</v-alert>
          <EmptyState
            v-else-if="library.length === 0"
            :icon="mdiBookshelf"
            title="No presets yet"
            :text="`The library has no ${label} presets yet. Save an event's settings to the library first.`"
          />
          <div v-else class="preset-choices">
            <v-card
              v-for="preset in library"
              :key="preset.id"
              rounded="lg"
              class="preset-choice"
              :disabled="choosing !== null"
              @click="choose(preset)"
            >
              <div class="d-flex align-center ga-3 pa-3">
                <v-avatar color="primary" variant="tonal" rounded="lg" size="40"><v-icon :icon="mdiBookshelf" /></v-avatar>
                <div class="flex-grow-1 min-width-0">
                  <div class="text-body-large font-weight-medium text-truncate">{{ preset.name }}</div>
                  <div v-if="preset.description" class="text-body-small text-medium-emphasis">{{ preset.description }}</div>
                  <div class="text-body-small text-medium-emphasis">
                    {{ preset.itemCount }} {{ preset.itemCount === 1 ? "setting" : "settings" }}<template v-if="preset.targetVersion">
                      · made for {{ kind === "tak" ? "ATAK" : "firmware" }} {{ preset.targetVersion }}
                    </template>
                  </div>
                </div>
                <v-progress-circular v-if="choosing === preset.id" indeterminate size="20" />
                <v-icon v-else :icon="mdiChevronRight" class="text-medium-emphasis" />
              </div>
            </v-card>
          </div>
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

<style scoped>
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
}
.preset-choices {
  display: grid;
  gap: 8px;
}
.min-width-0 {
  min-width: 0;
}
</style>
