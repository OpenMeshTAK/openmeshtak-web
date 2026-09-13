<script setup lang="ts">
import { ref, watch } from "vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { useToast } from "@/shared/feedback/toast";
import { emptySettings, settingsToRequest } from "../event-settings";
import { createEvent, type EventDto } from "../events.api";
import EventSettingsForm from "./EventSettingsForm.vue";

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ created: [event: EventDto] }>();
const toast = useToast();

const draft = ref(emptySettings());
const submission = useSubmission();

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = emptySettings();
    submission.reset();
  }
});

async function create(): Promise<void> {
  const created = await submission.run(() => createEvent(settingsToRequest(draft.value)));
  if (created !== null) {
    open.value = false;
    toast.success(`Event ${created.value.name} was created as a draft.`);
    emit("created", created.value);
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="pa-2">
      <v-card-title>New event</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          New events start as drafts and stay invisible to participants until you activate them.
        </p>
        <v-alert v-if="submission.error.value" type="error" class="mb-4">{{ submission.error.value }}</v-alert>
        <EventSettingsForm v-model="draft" :errors="submission.fields.value" auto-slug />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="submission.submitting.value" @click="create">Create draft</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
