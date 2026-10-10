<script setup lang="ts">
import { mdiContentCopy } from "@mdi/js";
import { ref, watch } from "vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import {
  createDataPackageCopy,
  type CombinedExportSelection,
  type DataPackageDto,
  type DataPackageKind,
} from "../data-packages.api";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  eventId: string;
  defaultName: string;
  sourceLabel: string;
  selection: CombinedExportSelection[];
  /** The kind of the new package; a mission editor copies into a new mission. */
  kind?: DataPackageKind;
  source?: "published" | "draft";
}>();
const emit = defineEmits<{ created: [dataPackage: DataPackageDto] }>();
const name = ref("");
const creation = useSubmission();

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = props.defaultName;
    creation.reset();
  }
});

async function create(): Promise<void> {
  const created = await creation.run(() =>
    createDataPackageCopy(props.eventId, { name: name.value.trim(), kind: props.kind ?? "package", source: props.source ?? "published", packages: props.selection }),
  );
  if (created !== null) {
    open.value = false;
    emit("created", created.value);
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title>Create {{ kind === "mission" ? "mission" : "data package" }} from layer</v-card-title>
      <v-card-text>
        <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
          Copies {{ sourceLabel }} from {{ source === 'draft' ? 'its current saved draft' : 'its latest published revision' }}. The new draft receives independent layer and item IDs.
        </p>
        <v-alert v-if="creation.error.value" type="error" class="mb-4">{{ creation.error.value }}</v-alert>
        <v-text-field
          v-model="name"
          :label="kind === 'mission' ? 'New mission name' : 'New data package name'"
          maxlength="100"
          autofocus
          :error-messages="messagesFor(creation.fields.value, 'name')"
          @keydown.enter="create"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="creation.submitting.value" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          :prepend-icon="mdiContentCopy"
          :loading="creation.submitting.value"
          :disabled="name.trim() === ''"
          @click="create"
        >
          Create and open
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
