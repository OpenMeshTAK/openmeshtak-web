<script setup lang="ts">
import { mdiQrcode } from "@mdi/js";
import { computed, onBeforeUnmount, ref } from "vue";
import { useToast } from "@/shared/feedback/toast";
import { createDownloadGrant, type DownloadGrant, type DownloadGrantRequest } from "@/shared/files/download-grant";
import QrCode from "./QrCode.vue";

/**
 * Shows a short-lived download link as a QR code, so the file lands directly on the phone that
 * scans it, for example to import it into ATAK or the Meshtastic app. The link exists only while
 * the dialog is open.
 */
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  request: DownloadGrantRequest;
  /** What the phone downloads, e.g. "the connection package". */
  fileLabel: string;
  disabled?: boolean;
  block?: boolean;
  size?: "small" | "default";
  /** Extra warning for files with secrets, such as channel keys. */
  secretNotice?: string;
}>();

const toast = useToast();
const open = ref(false);
const loading = ref(false);
const grant = ref<DownloadGrant | null>(null);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const expired = computed(() => grant.value !== null && new Date(grant.value.expiresAt).getTime() <= now.value);

async function show(): Promise<void> {
  loading.value = true;
  try {
    grant.value = await createDownloadGrant(props.request);
    now.value = Date.now();
    open.value = true;
    clearInterval(timer);
    timer = setInterval(() => {
      now.value = Date.now();
    }, 5000);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    loading.value = false;
  }
}

function close(): void {
  open.value = false;
  grant.value = null;
  clearInterval(timer);
}

onBeforeUnmount(() => {
  clearInterval(timer);
});
</script>

<template>
  <v-btn
    v-bind="$attrs"
    variant="tonal"
    :size="props.size ?? 'default'"
    :block="props.block"
    :prepend-icon="mdiQrcode"
    :disabled="props.disabled"
    :loading="loading"
    @click="show"
  >
    QR code
  </v-btn>
  <v-dialog :model-value="open" max-width="420" @update:model-value="close">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">Download on your phone</v-card-title>
      <v-card-text>
        <template v-if="grant && !expired">
          <p class="text-body-medium mt-0 mb-4">Scan this code with the phone that should get {{ props.fileLabel }}.</p>
          <div class="d-flex justify-center mb-4">
            <QrCode :value="grant.url" :label="`Download link for ${props.fileLabel}`" />
          </div>
          <p class="text-body-small text-medium-emphasis my-0">
            Works without signing in until {{ timeFormat.format(new Date(grant.expiresAt)) }}. Anyone who scans it can
            download the file, so show it only to the right phone.
          </p>
          <v-alert v-if="props.secretNotice" type="warning" density="compact" class="mt-3">{{ props.secretNotice }}</v-alert>
        </template>
        <template v-else>
          <p class="text-body-medium my-0">This code expired. Create a new one to download the file.</p>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="expired" color="primary" :loading="loading" @click="show">New code</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
