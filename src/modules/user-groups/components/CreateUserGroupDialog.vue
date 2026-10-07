<script setup lang="ts">
import { ref, watch } from "vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { useToast } from "@/shared/feedback/toast";
import { messagesFor } from "@/shared/errors/field-errors";
import { suggestSlug } from "@/modules/events/slug";
import { createUserGroup, type UserGroupDto } from "../user-groups.api";

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ created: [group: UserGroupDto] }>();
const toast = useToast();

const form = ref({ name: "", slug: "" });
const submission = useSubmission();

watch(open, (isOpen) => {
  if (isOpen) {
    form.value = { name: "", slug: "" };
    submission.reset();
  }
});

async function create(): Promise<void> {
  // Permissions and members are edited on the detail page right after creation.
  const created = await submission.run(() =>
    createUserGroup({ name: form.value.name, slug: form.value.slug, permissions: [] }),
  );
  if (created !== null) {
    open.value = false;
    toast.success(`User group ${created.value.name} was created.`);
    emit("created", created.value);
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card class="pa-2">
      <v-card-title>New user group</v-card-title>
      <v-card-text>
        <v-alert v-if="submission.error.value" type="error" class="mb-4">{{ submission.error.value }}</v-alert>
        <v-text-field
          v-model="form.name"
          placeholder="Editors"
          label="Name"
          class="mb-2"
          :error-messages="messagesFor(submission.fields.value, 'name')"
          @update:model-value="form.slug = suggestSlug($event)"
        />
        <v-text-field v-model="form.slug" label="Slug" :error-messages="messagesFor(submission.fields.value, 'slug')" />
        <p class="text-body-medium text-medium-emphasis my-0">You add permissions and members on the next page.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="submission.submitting.value" @click="create">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
