<script setup lang="ts">
import { mdiFileUpload } from "@mdi/js";
import { ref, watch } from "vue";

/**
 * Collects a PEM certificate (chain) and its private key, typed or loaded from files such as the
 * fullchain.pem and privkey.pem of Let's Encrypt. The key stays in this dialog until it is sent
 * once and is cleared when the dialog closes.
 */
const props = defineProps<{
  title: string;
  text: string;
  certificateLabel: string;
  saving: boolean;
  error: string | null;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ submit: [certificatePem: string, privateKeyPem: string] }>();

const certificatePem = ref("");
const privateKeyPem = ref("");

watch(open, (isOpen) => {
  if (!isOpen) {
    certificatePem.value = "";
    privateKeyPem.value = "";
  }
});

async function load(target: "certificate" | "key", files: File | File[] | null | undefined): Promise<void> {
  const file = Array.isArray(files) ? files[0] : files;
  if (file === undefined || file === null) {
    return;
  }
  const text = await file.text();
  if (target === "certificate") {
    certificatePem.value = text;
  } else {
    privateKeyPem.value = text;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="640">
    <v-card class="pa-2">
      <v-card-title>{{ props.title }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ props.text }}</p>
        <v-alert v-if="props.error" type="error" density="compact" class="mb-4">{{ props.error }}</v-alert>
        <v-file-input
          :label="`${props.certificateLabel} file`"
          accept=".pem,.crt,.cer"
          :prepend-icon="mdiFileUpload"
          density="compact"
          @update:model-value="load('certificate', $event)"
        />
        <v-textarea v-model="certificatePem" :label="props.certificateLabel" rows="4" class="pem-field" />
        <v-file-input
          label="Private key file"
          accept=".pem,.key"
          :prepend-icon="mdiFileUpload"
          density="compact"
          @update:model-value="load('key', $event)"
        />
        <v-textarea v-model="privateKeyPem" label="Private key (PEM, unencrypted)" rows="4" class="pem-field" autocomplete="off" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="props.saving"
          :disabled="certificatePem.trim() === '' || privateKeyPem.trim() === ''"
          @click="emit('submit', certificatePem, privateKeyPem)"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pem-field :deep(textarea) {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
</style>
