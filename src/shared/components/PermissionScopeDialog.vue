<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import { ref, watch } from "vue";
import type { Permission } from "@/shared/api/types";
import PermissionTree from "./PermissionTree.vue";

/**
 * Permission tree for one scope ("All events" or a single event) in a dialog. Changes go to a draft
 * and only reach the model on "Apply", so cancelling leaves the permissions untouched.
 */
defineProps<{
  title: string;
  subtitle: string;
  eventScoped: boolean;
  disabled?: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const permissions = defineModel<Permission[]>({ required: true });

const draft = ref<Permission[]>([]);

watch(
  open,
  (isOpen) => {
    if (isOpen) draft.value = [...permissions.value];
  },
  { immediate: true },
);

function apply(): void {
  permissions.value = draft.value;
  open.value = false;
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="flex-grow-1">{{ title }}</span>
        <v-btn :icon="mdiClose" variant="text" size="small" aria-label="Close" @click="open = false" />
      </v-card-title>
      <v-card-subtitle class="pb-2">{{ subtitle }}</v-card-subtitle>
      <v-card-text>
        <PermissionTree v-model="draft" :event-scoped="eventScoped" :disabled="disabled" />
      </v-card-text>
      <v-card-actions v-if="!disabled">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="apply">Apply</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
