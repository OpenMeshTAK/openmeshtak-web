<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import PresetPreviewList from "./PresetPreviewList.vue";
import {
  importMeshtasticPreset,
  previewMeshtasticPreset,
  type MeshtasticPresetPreviewDto,
  type PresetDocumentDto,
} from "./settings-presets.api";

/**
 * Shows what a Meshtastic preset would change in the event's draft, checked by Core against the
 * event's own firmware profile, and imports exactly that after confirmation.
 */
const props = defineProps<{ eventId: string; document: PresetDocumentDto | null; labels: Record<string, string> }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ imported: [] }>();

const preview = ref<MeshtasticPresetPreviewDto | null>(null);
const loading = useSubmission();
const importing = useSubmission();

function label(key: string): string {
  return props.labels[key] ?? key;
}

function display(value: unknown): string {
  return value === null || value === undefined ? "—" : String(value);
}

const changes = computed(() =>
  (preview.value?.changed ?? []).map(({ key, from, to }) => ({ key, title: label(key), detail: `${display(from)} → ${display(to)}` })),
);
const invalid = computed(() => (preview.value?.invalid ?? []).map(({ key, message }) => ({ key, title: label(key), detail: message })));
const unsupported = computed(() => (preview.value?.unsupported ?? []).map((key) => ({ key, title: key })));

async function load(): Promise<void> {
  preview.value = null;
  importing.reset();
  if (props.document === null) {
    return;
  }
  const document = props.document;
  const result = await loading.run(() => previewMeshtasticPreset(props.eventId, document));
  preview.value = result?.value ?? null;
}

watch(open, (isOpen) => {
  if (isOpen) {
    void load();
  }
});

async function confirm(): Promise<void> {
  if (preview.value === null || props.document === null) {
    return;
  }
  const body = { version: preview.value.version, document: props.document, confirmation: preview.value.confirmation };
  const result = await importing.run(() => importMeshtasticPreset(props.eventId, body));
  if (result !== null) {
    open.value = false;
    emit("imported");
  } else if (importing.code.value === "VERSION_CONFLICT" || importing.code.value === "PRESET_IMPORT_UNCONFIRMED") {
    // The draft changed since the preview; show the current outcome before anything is written.
    const message = importing.error.value;
    await load();
    importing.error.value = `${message ?? ""} The preview was updated; check it and import again.`.trim();
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="760" scrollable>
    <v-card>
      <v-card-title class="text-title-large font-weight-medium text-wrap pt-4 px-6">Import “{{ document?.name }}”</v-card-title>
      <v-card-text class="px-6">
        <v-skeleton-loader v-if="loading.submitting.value" type="list-item@4" />
        <v-alert v-else-if="loading.error.value" type="error" variant="tonal">
          {{ loading.error.value }}
          <div v-for="(message, field) in loading.fields.value" :key="field" class="text-body-small">{{ field }}: {{ message }}</div>
        </v-alert>
        <template v-else-if="preview !== null">
          <p class="text-body-medium mt-0 mb-4">
            Checked against this event's firmware {{ preview.eventFirmwareVersion }}. The preset was made for {{ preview.presetFirmwareVersion }}.
            <InfoHint
              v-if="!preview.sameFirmwareLine"
              tone="warning"
              label="Different firmware line"
              text="The preset was made for another firmware line. Settings this event's firmware does not have are left out; the event's firmware is not changed."
            />
          </p>

          <PresetPreviewList title="Changes" :items="changes" empty="Nothing would change; the event already has these values." />
          <PresetPreviewList
            title="Left out: invalid values"
            hint="The event's firmware rejects these values, so the current value stays."
            warning
            :items="invalid"
          />
          <PresetPreviewList
            title="Left out: not supported"
            hint="Unknown keys, secrets and values OpenMeshTak sets for each member are never imported."
            warning
            :items="unsupported"
          />
          <p class="text-body-medium text-medium-emphasis mb-1">
            {{ preview.unchanged.length }} already the same · {{ preview.notInPreset.length }} not in the preset keep their current value.
          </p>
          <p v-if="preview.secretsKept.length > 0" class="text-body-medium text-medium-emphasis mb-1">
            Passwords and PINs set on this event stay unchanged ({{ preview.secretsKept.map(label).join(", ") }}).
          </p>
          <p class="text-body-medium text-medium-emphasis mb-0">Importing changes the draft only. Publish the configuration so members get it.</p>
        </template>
        <v-alert v-if="importing.error.value" type="error" variant="tonal" class="mt-4">{{ importing.error.value }}</v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="importing.submitting.value" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="importing.submitting.value" :disabled="preview === null || changes.length === 0" @click="confirm">
          Import {{ changes.length }} {{ changes.length === 1 ? "change" : "changes" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
