<script setup lang="ts">
import { ref, watch } from "vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import { createPreset, type PresetDocumentDto, type SettingsPresetDto } from "./settings-presets.api";

/**
 * Saves a preset document to the global library under a name. The library keeps its own copy:
 * later edits there never change the event the settings came from.
 */
const props = defineProps<{ document: PresetDocumentDto | null; title?: string }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [preset: SettingsPresetDto] }>();

const name = ref("");
const description = ref("");
const submission = useSubmission();

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = props.document?.name ?? "";
    description.value = props.document?.description ?? "";
    submission.reset();
  }
});

async function save(): Promise<void> {
  if (props.document === null) {
    return;
  }
  const document = props.document;
  const result = await submission.run(() =>
    createPreset({ document, name: name.value.trim(), description: description.value.trim() === "" ? null : description.value.trim() }),
  );
  if (result !== null) {
    open.value = false;
    emit("saved", result.value);
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-medium">{{ title ?? "Save to preset library" }}</v-card-title>
      <v-card-text>
        <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
          Every event manager can apply library presets. Secrets, PINs and member-specific values are never included.
        </p>
        <v-text-field v-model="name" label="Name" maxlength="100" autofocus :error-messages="messagesFor(submission.fields.value, 'name')" />
        <v-textarea v-model="description" label="Description (optional)" maxlength="1000" rows="2" auto-grow />
        <v-alert v-if="submission.error.value" type="error" variant="tonal" class="mt-2">
          {{ submission.error.value }}
          <div v-for="(message, field) in submission.fields.value" :key="field" class="text-body-small">{{ field }}: {{ message }}</div>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submission.submitting.value" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="submission.submitting.value" :disabled="name.trim() === '' || document === null" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
