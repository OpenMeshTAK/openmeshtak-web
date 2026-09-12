<script setup lang="ts">
import { mdiContentCopy } from "@mdi/js";
import { ref } from "vue";

/**
 * Shows a newly created secret exactly once (DESIGN.md). The parent owns the value only for as long
 * as this component is visible and must drop it on `dismiss`. Copying is an explicit action.
 */
const props = defineProps<{ secret: string; label: string }>();
const emit = defineEmits<{ dismiss: [] }>();
const copied = ref(false);

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(props.secret);
  copied.value = true;
}
</script>

<template>
  <div>
    <v-alert type="warning" class="mb-4">
      Copy this {{ label }} now. It cannot be shown again; if it is lost, create a new one.
    </v-alert>
    <v-text-field :model-value="secret" :label="label" readonly hide-details class="mb-2" style="font-family: monospace">
      <template #append-inner>
        <v-btn :icon="mdiContentCopy" variant="text" size="small" :aria-label="`Copy ${label}`" @click="copy" />
      </template>
    </v-text-field>
    <div class="d-flex align-center">
      <span class="text-caption text-medium-emphasis">{{ copied ? "Copied to the clipboard." : "Not copied yet." }}</span>
      <v-spacer />
      <v-btn color="primary" variant="flat" @click="emit('dismiss')">I have stored it</v-btn>
    </div>
  </div>
</template>
