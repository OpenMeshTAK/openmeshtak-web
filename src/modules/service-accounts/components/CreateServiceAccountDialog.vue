<script setup lang="ts">
import { ref, watch } from "vue";
import type { Schemas } from "@/shared/api/types";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import { createServiceAccount, type ServiceAccountDto } from "../service-accounts.api";

const props = defineProps<{ events: { id: string; name: string }[] }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ created: [account: ServiceAccountDto] }>();

const form = ref({ name: "", description: "" });
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const submission = useSubmission();

watch(open, (isOpen) => {
  if (isOpen) {
    form.value = { name: "", description: "" };
    // A typical integration synchronizes members of one event.
    grants.value = [{ permission: "members.sync", eventId: props.events[0]?.id ?? null }];
    submission.reset();
  }
});

async function create(): Promise<void> {
  const created = await submission.run(() =>
    createServiceAccount({
      name: form.value.name,
      description: form.value.description || null,
      permissions: grants.value,
    }),
  );
  if (created !== null) {
    open.value = false;
    emit("created", created.value);
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="760" scrollable>
    <v-card class="pa-2">
      <v-card-title>New service account</v-card-title>
      <v-card-text>
        <v-alert v-if="submission.error.value" type="error" class="mb-4">{{ submission.error.value }}</v-alert>
        <v-text-field
          v-model="form.name"
          label="Name"
          hint="e.g. Terra Bot"
          persistent-hint
          class="mb-2"
          :error-messages="messagesFor(submission.fields.value, 'name')"
        />
        <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow class="mb-2" />
        <div class="text-subtitle-2 mb-1">Permissions</div>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Grant only what the integration needs and limit it to specific events where possible. You can
          only grant permissions you hold yourself.
        </p>
        <PermissionGrantEditor v-model="grants" :events="events" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="submission.submitting.value" @click="create">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
