<script setup lang="ts">
import { mdiShieldKey } from "@mdi/js";
import { ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { importCertificateAuthority, rotateCertificateAuthority, type TakCertificateAuthorityDto } from "../tak-server.api";
import PemUploadDialog from "./PemUploadDialog.vue";

/** The CAs that sign TAK client certificates; older ones stay trusted until they expire. */
defineProps<{ authorities: TakCertificateAuthorityDto[] }>();
const emit = defineEmits<{ changed: [] }>();
const toast = useToast();

const dialogOpen = ref(false);
const rotating = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

async function rotate(): Promise<void> {
  rotating.value = false;
  try {
    await rotateCertificateAuthority();
    toast.success("New certificate authority created. The previous one stays trusted until it expires.");
    emit("changed");
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function importAuthority(certificatePem: string, privateKeyPem: string): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    await importCertificateAuthority(certificatePem, privateKeyPem);
    dialogOpen.value = false;
    toast.success("Certificate authority imported. New client certificates are signed by it.");
    emit("changed");
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center pb-2">
      <v-icon :icon="mdiShieldKey" class="mr-2" />
      <div class="d-flex align-center ga-1 flex-grow-1">
        <span class="text-title-medium font-weight-medium">Client certificate authority</span>
        <InfoHint label="About the client certificate authority">
          The OpenMeshTak CA signs the certificate of every member's TAK app, and the server
          certificate while no Let's Encrypt or uploaded certificate is used. Created automatically;
          usually nothing to do here. A new or imported CA signs future certificates, and older CAs
          stay trusted until they expire. Keys never leave the server.
        </InfoHint>
      </div>
      <div class="d-flex ga-2">
        <v-btn variant="text" @click="rotating = true">New CA</v-btn>
        <v-btn variant="tonal" @click="dialogOpen = true">Import CA</v-btn>
      </div>
    </div>
    <v-list lines="two" class="pa-0 bg-transparent">
      <v-list-item v-for="authority in authorities" :key="authority.id" :title="authority.subject">
        <v-list-item-subtitle>
          {{ authority.origin === "generated" ? "Created by OpenMeshTak" : "Imported" }} · valid until
          {{ dateFormat.format(new Date(authority.notAfter)) }} · SHA-256 {{ authority.fingerprintSha256.slice(0, 16) }}…
        </v-list-item-subtitle>
        <template #append>
          <v-chip v-if="authority.active" size="small" color="success" variant="tonal">Active</v-chip>
          <v-chip v-else size="small" variant="tonal">Still trusted</v-chip>
        </template>
      </v-list-item>
    </v-list>

    <ConfirmDialog
      :model-value="rotating"
      title="Create a new certificate authority?"
      confirm-label="Create"
      @update:model-value="rotating = false"
      @confirm="rotate"
    >
      New client certificates are signed by the new CA. Enrolled devices keep working while the
      current CA has not expired. Requires a recent sign-in.
    </ConfirmDialog>
    <PemUploadDialog
      v-model="dialogOpen"
      title="Import certificate authority"
      text="The imported CA signs all new client certificates. The current CA stays trusted until it expires, so enrolled devices keep working. Requires a recent sign-in."
      certificate-label="CA certificate (PEM)"
      :saving="saving"
      :error="error"
      @submit="importAuthority"
    />
  </div>
</template>
