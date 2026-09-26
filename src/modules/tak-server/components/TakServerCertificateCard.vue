<script setup lang="ts">
import { mdiCertificate } from "@mdi/js";
import { computed, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { addTakServerCertificate, removeTakServerCertificate, type TakServerSettingsDto } from "../tak-server.api";
import PemUploadDialog from "./PemUploadDialog.vue";

/**
 * The TLS certificate of the TAK ports: issued by the OpenMeshTak CA, or a publicly trusted one
 * such as Let's Encrypt that devices trust without installing the OpenMeshTak CA.
 */
const props = defineProps<{ settings: TakServerSettingsDto }>();
const emit = defineEmits<{ changed: [settings: TakServerSettingsDto] }>();
const toast = useToast();

const dialogOpen = ref(false);
const removing = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const certificate = computed(() => props.settings.serverCertificate);
const isAdded = computed(() => certificate.value?.source === "added");

async function add(chainPem: string, keyPem: string): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    emit("changed", await addTakServerCertificate(chainPem, keyPem));
    dialogOpen.value = false;
    toast.success("Server certificate added.");
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}

async function remove(): Promise<void> {
  removing.value = false;
  try {
    emit("changed", await removeTakServerCertificate());
    toast.success("The server now uses a certificate from the OpenMeshTak CA.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-3">
      <v-icon :icon="mdiCertificate" class="mr-2" />
      <div class="text-subtitle-1 font-weight-medium flex-grow-1">Server certificate</div>
      <v-chip size="small" variant="tonal" :color="isAdded ? 'success' : undefined">
        {{ isAdded ? "Publicly trusted" : "OpenMeshTak CA" }}
      </v-chip>
    </div>
    <template v-if="certificate">
      <div class="text-body-2">{{ certificate.subject }}</div>
      <div class="text-caption text-medium-emphasis">
        For {{ certificate.hostName }} · valid until {{ dateFormat.format(new Date(certificate.notAfter)) }}
      </div>
      <div class="text-caption text-medium-emphasis text-truncate">SHA-256 {{ certificate.fingerprintSha256 }}</div>
    </template>
    <p v-else class="text-body-2 text-medium-emphasis mb-0">
      Issued automatically by the OpenMeshTak CA when the server starts.
    </p>
    <p class="text-body-2 text-medium-emphasis mt-3 mb-3">
      With a Let's Encrypt certificate for the host name, phones trust the TAK server without
      installing the OpenMeshTak CA. Client certificates always come from the OpenMeshTak CA.
    </p>
    <div class="d-flex ga-2">
      <v-btn variant="tonal" :disabled="settings.hostName === null" @click="dialogOpen = true">
        {{ isAdded ? "Replace certificate" : "Add Let's Encrypt certificate" }}
      </v-btn>
      <v-btn v-if="isAdded" variant="text" color="error" @click="removing = true">Use OpenMeshTak CA</v-btn>
    </div>

    <PemUploadDialog
      v-model="dialogOpen"
      title="Add server certificate"
      :text="`Paste or load fullchain.pem and privkey.pem for ${settings.hostName ?? 'the host name'}. The chain must lead to a publicly trusted root. Requires a recent sign-in.`"
      certificate-label="Full certificate chain (PEM)"
      :saving="saving"
      :error="error"
      @submit="add"
    />
    <ConfirmDialog
      :model-value="removing"
      title="Remove the added certificate?"
      confirm-label="Remove"
      confirm-color="error"
      @update:model-value="removing = false"
      @confirm="remove"
    >
      The server switches to a certificate from the OpenMeshTak CA. Devices then need the
      OpenMeshTak CA to trust the server.
    </ConfirmDialog>
  </v-card>
</template>
