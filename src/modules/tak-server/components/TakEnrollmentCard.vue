<script setup lang="ts">
import { mdiCellphoneLink } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useToast } from "@/shared/feedback/toast";
import { listMyTakCertificates, revokeMyTakCertificate, type TakClientCertificateDto } from "../tak-server.api";
import TakClientCertificatesTable from "./TakClientCertificatesTable.vue";
import TakEnrollmentAction from "./TakEnrollmentAction.vue";
import InfoHint from "@/shared/components/InfoHint.vue";

/** Connects a TAK app to the built-in TAK server and lists the apps already connected with it. */
const toast = useToast();
const certificates = ref<TakClientCertificateDto[]>([]);

async function loadCertificates(): Promise<void> {
  try {
    certificates.value = await listMyTakCertificates();
  } catch {
    certificates.value = [];
  }
}

async function revoke(certificate: TakClientCertificateDto): Promise<void> {
  try {
    await revokeMyTakCertificate(certificate.id);
    toast.success("The certificate was revoked and its app disconnected.");
    await loadCertificates();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(loadCertificates);
</script>

<template>
  <v-card>
    <div class="pa-5 pb-3">
      <div class="d-flex align-center ga-2 mb-2">
        <v-icon :icon="mdiCellphoneLink" size="small" />
        <div class="text-subtitle-1 font-weight-medium">TAK server</div>
        <InfoHint
          label="About the TAK server"
          text="Connect ATAK or iTAK to share positions and markers with your event and receive its Data Packages."
        />
        <v-spacer />
        <v-chip size="small" color="warning" variant="tonal">Not verified</v-chip>
      </div>
      <TakEnrollmentAction @closed="loadCertificates" />
    </div>
    <template v-if="certificates.length > 0">
      <div class="px-5 text-caption text-medium-emphasis">Your connected apps</div>
      <TakClientCertificatesTable :certificates="certificates" :show-user="false" @revoke="revoke" />
    </template>
  </v-card>
</template>
