<script setup lang="ts">
import { mdiBookshelf, mdiDeleteOutline, mdiDownload, mdiFileImportOutline, mdiPencilOutline } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import SegmentedControl from "@/shared/components/SegmentedControl.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { downloadPreset, KIND_LABELS, MAX_PRESET_FILE_BYTES } from "./preset-file";
import SavePresetDialog from "./SavePresetDialog.vue";
import {
  deletePreset,
  getPreset,
  listPresets,
  updatePreset,
  type PresetDocumentDto,
  type PresetKind,
  type SettingsPresetSummaryDto,
} from "./settings-presets.api";

/**
 * The global library of TAK and Meshtastic presets. Events import a preset from their own settings
 * and keep an independent copy, so changing or deleting a preset here never changes an event.
 */
const session = useSession();
const toast = useToast();
const kind = ref<PresetKind | "all">("all");
const KIND_FILTERS = [
  { title: "All", value: "all" as const },
  { title: KIND_LABELS.tak, value: "tak" as const },
  { title: KIND_LABELS.meshtastic, value: "meshtastic" as const },
];
const page = useAsyncData(() => listPresets(), [] as SettingsPresetSummaryDto[]);
const shown = computed(() => page.data.value.filter((preset) => kind.value === "all" || preset.kind === kind.value));
/** The library uses its own instance-wide write permission. */
const canWrite = computed(() => session.can("presets.manage", null));

const fileInput = ref<HTMLInputElement | null>(null);
const fileError = ref("");
const uploadOpen = ref(false);
const uploadDocument = ref<PresetDocumentDto | null>(null);

const editing = ref<SettingsPresetSummaryDto | null>(null);
const editOpen = ref(false);
const editName = ref("");
const editDescription = ref("");
const edit = useSubmission();

const deleting = ref<SettingsPresetSummaryDto | null>(null);
const deleteOpen = ref(false);
const remove = useSubmission();

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  fileError.value = "";
  if (file === undefined) {
    return;
  }
  if (file.size > MAX_PRESET_FILE_BYTES) {
    fileError.value = "The file is larger than 512 KB.";
    return;
  }
  try {
    const parsed = JSON.parse(await file.text()) as { format?: unknown };
    if (typeof parsed !== "object" || parsed === null || parsed.format !== "openmeshtak-preset") {
      throw new Error("not a preset");
    }
    uploadDocument.value = parsed as PresetDocumentDto;
    uploadOpen.value = true;
  } catch {
    fileError.value = "This is not an OpenMeshTak preset (.json).";
  }
}

async function download(preset: SettingsPresetSummaryDto): Promise<void> {
  try {
    downloadPreset((await getPreset(preset.id)).document);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

function startEdit(preset: SettingsPresetSummaryDto): void {
  editing.value = preset;
  editName.value = preset.name;
  editDescription.value = preset.description ?? "";
  edit.reset();
  editOpen.value = true;
}

async function saveEdit(): Promise<void> {
  const preset = editing.value;
  if (preset === null) {
    return;
  }
  const description = editDescription.value.trim();
  const result = await edit.run(() =>
    updatePreset(preset.id, { version: preset.version, name: editName.value.trim(), description: description === "" ? null : description }),
  );
  if (result !== null) {
    editOpen.value = false;
    await page.load();
  }
}

function startDelete(preset: SettingsPresetSummaryDto): void {
  deleting.value = preset;
  remove.reset();
  deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  const preset = deleting.value;
  if (preset === null) {
    return;
  }
  const result = await remove.run(() => deletePreset(preset.id));
  if (result !== null) {
    deleteOpen.value = false;
    toast.success(`Deleted “${preset.name}”.`);
    await page.load();
  }
}

async function uploaded(): Promise<void> {
  toast.success("Preset added to the library.");
  await page.load();
}

onMounted(page.load);
</script>

<template>
  <div>
    <ViewHeader title="Presets" subtitle="Reusable TAK and Meshtastic settings. Events import them from their own settings and keep an independent copy.">
      <template v-if="canWrite" #actions>
        <v-btn color="primary" :prepend-icon="mdiFileImportOutline" @click="fileInput?.click()">Add from file</v-btn>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChosen">
      </template>
    </ViewHeader>

    <v-alert v-if="fileError" type="error" variant="tonal" class="mb-4">{{ fileError }}</v-alert>

    <SegmentedControl v-model="kind" :options="KIND_FILTERS" label="Kind" size="default" inline class="mb-4" />

    <v-skeleton-loader v-if="page.state.value === 'loading'" type="table" />
    <v-alert v-else-if="page.state.value === 'error'" type="error">{{ page.error.value }}</v-alert>
    <EmptyState
      v-else-if="shown.length === 0"
      :icon="mdiBookshelf"
      title="No presets yet"
      text="Open an event's TAK or Meshtastic settings and use Presets → Save to library, or add a preset file here."
    />
    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Kind</th>
            <th>Settings</th>
            <th>Made for</th>
            <th>Updated</th>
            <th><span class="d-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="preset in shown" :key="preset.id">
            <td>
              <div class="font-weight-medium">{{ preset.name }}</div>
              <div v-if="preset.description" class="text-body-small text-medium-emphasis">{{ preset.description }}</div>
            </td>
            <td>{{ KIND_LABELS[preset.kind] }}</td>
            <td>{{ preset.itemCount }}</td>
            <td>{{ preset.targetVersion ? `${preset.kind === "tak" ? "ATAK" : "Firmware"} ${preset.targetVersion}` : "—" }}</td>
            <td>{{ new Date(preset.updatedAt).toLocaleDateString() }}</td>
            <td class="text-right text-no-wrap">
              <v-btn :icon="mdiDownload" variant="text" size="small" aria-label="Download" @click="download(preset)" />
              <template v-if="canWrite">
                <v-btn :icon="mdiPencilOutline" variant="text" size="small" aria-label="Rename" @click="startEdit(preset)" />
                <v-btn :icon="mdiDeleteOutline" variant="text" size="small" aria-label="Delete" @click="startDelete(preset)" />
              </template>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <SavePresetDialog v-model="uploadOpen" :document="uploadDocument" title="Add preset to library" @saved="uploaded" />

    <v-dialog v-model="editOpen" max-width="520">
      <v-card class="pa-2">
        <v-card-title class="text-title-large font-weight-medium">Rename preset</v-card-title>
        <v-card-text>
          <v-text-field v-model="editName" label="Name" maxlength="100" :error-messages="messagesFor(edit.fields.value, 'name')" />
          <v-textarea v-model="editDescription" label="Description (optional)" maxlength="1000" rows="2" auto-grow />
          <v-alert v-if="edit.error.value" type="error" variant="tonal">{{ edit.error.value }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="edit.submitting.value" @click="editOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="edit.submitting.value" :disabled="editName.trim() === ''" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog v-model="deleteOpen" title="Delete preset?" confirm-label="Delete" confirm-color="error" :loading="remove.submitting.value" @confirm="confirmDelete">
      “{{ deleting?.name }}” is removed from the library. Events that imported it keep their settings.
      <v-alert v-if="remove.error.value" type="error" variant="tonal" class="mt-3">{{ remove.error.value }}</v-alert>
    </ConfirmDialog>
  </div>
</template>
