<script setup lang="ts">
import { mdiShieldKey } from "@mdi/js";
import { ref } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { importCertificateAuthority, type TakCertificateAuthorityDto } from "../tak-server.api";
import PemUploadDialog from "./PemUploadDialog.vue";

/** The CAs that sign TAK client certificates; older ones stay trusted until they expire. */
defineProps<{ authorities: TakCertificateAuthorityDto[] }>();
const emit = defineEmits<{ changed: [] }>();
const toast = useToast();

const dialogOpen = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

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
  <v-card>
    <div class="d-flex align-center pa-5 pb-2">
      <v-icon :icon="mdiShieldKey" class="mr-2" />
      <div class="flex-grow-1">
        <div class="text-subtitle-1 font-weight-medium">Certificate authorities</div>
        <div class="text-body-2 text-medium-emphasis">Sign the client certificates of TAK apps. Keys never leave the server.</div>
      </div>
      <v-btn variant="tonal" @click="dialogOpen = true">Import CA</v-btn>
    </div>
    <v-list lines="two" class="pt-0">
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

    <PemUploadDialog
      v-model="dialogOpen"
      title="Import certificate authority"
      text="The imported CA signs all new client certificates. The current CA stays trusted until it expires, so enrolled devices keep working. Requires a recent sign-in."
      certificate-label="CA certificate (PEM)"
      :saving="saving"
      :error="error"
      @submit="importAuthority"
    />
  </v-card>
</template>
