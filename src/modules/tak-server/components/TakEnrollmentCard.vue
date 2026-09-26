<script setup lang="ts">
import { mdiCellphoneLink, mdiDownload } from "@mdi/js";
import { onMounted, ref } from "vue";
import QrCode from "@/shared/components/QrCode.vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import {
  createTakEnrollment,
  listMyTakCertificates,
  revokeMyTakCertificate,
  type TakClientCertificateDto,
  type TakEnrollmentDto,
} from "../tak-server.api";
import TakClientCertificatesTable from "./TakClientCertificatesTable.vue";

/**
 * Connects a TAK app to the built-in TAK server. The enrollment password is single-use, valid for
 * a few minutes and only kept while the dialog is open; the account password never reaches the app.
 */
const toast = useToast();
const enrollment = ref<TakEnrollmentDto | null>(null);
const creating = ref(false);
const unavailable = ref(false);
const certificates = ref<TakClientCertificateDto[]>([]);
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

async function loadCertificates(): Promise<void> {
  try {
    certificates.value = await listMyTakCertificates();
  } catch {
    certificates.value = [];
  }
}

async function create(): Promise<void> {
  creating.value = true;
  try {
    enrollment.value = await createTakEnrollment();
  } catch (caught: unknown) {
    if (isApiProblem(caught, "TAK_SERVER_NOT_READY")) {
      unavailable.value = true;
    } else {
      toast.error(caught);
    }
  } finally {
    creating.value = false;
  }
}

async function close(): Promise<void> {
  enrollment.value = null;
  await loadCertificates();
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
        <div class="text-subtitle-1 font-weight-medium flex-grow-1">TAK server</div>
        <v-chip size="small" color="warning" variant="tonal">Not verified</v-chip>
      </div>
      <p class="text-body-2 text-medium-emphasis mb-3">
        Connect ATAK or iTAK to share positions and markers with your event and receive its Data Packages.
      </p>
      <v-alert v-if="unavailable" type="info" density="compact" variant="tonal" class="mb-3">
        The TAK server is not enabled yet. Your organizers will tell you when it is.
      </v-alert>
      <v-btn color="primary" block :loading="creating" :disabled="unavailable" @click="create">Connect a TAK app</v-btn>
    </div>
    <template v-if="certificates.length > 0">
      <div class="px-5 text-caption text-medium-emphasis">Your connected apps</div>
      <TakClientCertificatesTable :certificates="certificates" :show-user="false" @revoke="revoke" />
    </template>

    <v-dialog :model-value="enrollment !== null" max-width="520" @update:model-value="close">
      <v-card v-if="enrollment" class="pa-2">
        <v-card-title>Connect a TAK app</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">
            <strong>ATAK:</strong> scan this code with the ATAK QR scanner, or open the link on the phone with ATAK.
            The code works once and expires at {{ timeFormat.format(new Date(enrollment.expiresAt)) }}.
          </p>
          <div class="d-flex justify-center mb-2">
            <QrCode :value="enrollment.atakEnrollmentUrl" label="ATAK enrollment code" :size="220" />
          </div>
          <div class="d-flex justify-center mb-4">
            <v-btn :href="enrollment.atakEnrollmentUrl" variant="tonal" size="small">Open in ATAK</v-btn>
          </div>
          <p class="text-body-2 mb-2">
            <strong>iTAK or manual setup:</strong> import the connection package, or add a server with
            certificate enrollment, and sign in with:
          </p>
          <v-btn href="/api/v1/me/tak-connection-package" download variant="tonal" size="small" class="mb-3" :prepend-icon="mdiDownload">
            Connection package
          </v-btn>
          <v-table density="compact">
            <tbody>
              <tr><td>Address</td><td><code>{{ enrollment.hostName }}</code></td></tr>
              <tr><td>Port</td><td><code>{{ enrollment.streamingPort }}</code> (SSL)</td></tr>
              <tr><td>Username</td><td><code class="text-break">{{ enrollment.username }}</code></td></tr>
              <tr><td>Password</td><td><code>{{ enrollment.token }}</code></td></tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="close">Done</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>
