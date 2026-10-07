<script setup lang="ts">
import { mdiContentCopy } from "@mdi/js";
import { computed, ref } from "vue";
import QrCode from "./QrCode.vue";

/**
 * Shows a newly created single-use link with its QR code. The link carries a bearer token, so the
 * parent keeps it only in memory while this is visible and drops it when the dialog closes.
 * Copying is an explicit action.
 */
const props = defineProps<{ url: string; label: string; expiresAt: string }>();
const copied = ref(false);
const validUntil = computed(() => new Date(props.expiresAt).toLocaleString());

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(props.url);
  copied.value = true;
}
</script>

<template>
  <div>
    <v-alert type="warning" class="mb-4">
      <slot>Share this link privately. It is shown only now and cannot be displayed again.</slot>
    </v-alert>
    <div class="d-flex justify-center mb-4">
      <QrCode :value="url" :label="`${label} QR code`" />
    </div>
    <v-text-field :model-value="url" :label="label" readonly hide-details class="mb-2">
      <template #append-inner>
        <v-btn :icon="mdiContentCopy" variant="text" size="small" :aria-label="`Copy ${label}`" @click="copy" />
      </template>
    </v-text-field>
    <div class="text-body-small text-medium-emphasis">{{ copied ? "Copied. " : "" }}Valid until {{ validUntil }}, single use.</div>
  </div>
</template>
