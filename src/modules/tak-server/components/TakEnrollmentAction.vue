<script setup lang="ts">
import { mdiDownload } from "@mdi/js";
import type { Socket } from "socket.io-client";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";
import QrCode from "@/shared/components/QrCode.vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { connectRealtime } from "@/shared/realtime/realtime";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { createTakEnrollment, listMyTakCertificates, revokeMyTakCertificate, type TakEnrollmentDto } from "../tak-server.api";

/**
 * Connects a TAK app to the built-in TAK server: QR code for ATAK, the connection package and
 * manual login data. People log in with their username and OpenMeshTak password; the QR code
 * carries a QR token instead, which lives only while the dialog is open.
 */
withDefaults(defineProps<{ label?: string }>(), { label: "Connect a TAK app" });
const emit = defineEmits<{ closed: [] }>();

const toast = useToast();
const { xs } = useDisplay();
const enrollment = ref<TakEnrollmentDto | null>(null);
const creating = ref(false);
const unavailable = ref(false);
const client = ref<"atak" | "itak">("atak");
const method = ref<"qr" | "package" | "login">("qr");
const session = useSession();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const needsPassword = computed(() => session.state.principal?.hasPassword === false);
const qrValue = computed(() =>
  client.value === "atak" ? enrollment.value?.atakEnrollmentUrl : enrollment.value?.itakQrString,
);
const qrAvailable = computed(() => qrValue.value !== null && qrValue.value !== undefined);
const packageHref = computed(() =>
  client.value === "atak" ? "/api/v1/me/tak-connection-package" : "/api/v1/me/itak-connection-package",
);
const packageGrantKind = computed((): "tak-connection-package" | "itak-connection-package" =>
  client.value === "atak" ? "tak-connection-package" : "itak-connection-package",
);
const downloadQrProps = computed(() => {
  const common = {
    request: { kind: packageGrantKind.value },
    fileLabel: `the ${client.value === "atak" ? "ATAK" : "iTAK"} connection package`,
  };
  return client.value === "itak"
    ? { ...common, secretNotice: "This package contains your private TAK client key. Do not share the QR code or downloaded file." }
    : common;
});
const showPasswordWarning = computed(
  () => needsPassword.value && (method.value === "login" || (client.value === "itak" && method.value === "qr")),
);

// Each iTAK package carries its own private key, so Core issues one at a time per user.
const itakDownloaded = ref(false);
const itakPackageIssued = computed(
  () => client.value === "itak" && (itakDownloaded.value || enrollment.value?.itakPackageCertificateId != null),
);
const confirmingRevoke = ref(false);
const revokingPackage = ref(false);

function packageDownloaded(): void {
  if (client.value === "itak") itakDownloaded.value = true;
}

async function revokeItakPackage(): Promise<void> {
  revokingPackage.value = true;
  try {
    // A download in this dialog does not return the certificate ID, so look it up.
    const id =
      enrollment.value?.itakPackageCertificateId ??
      (await listMyTakCertificates()).find(
        ({ status, clientUid }) => status === "valid" && clientUid?.startsWith("ITAK-PACKAGE-") === true,
      )?.id;
    if (id !== undefined) await revokeMyTakCertificate(id);
    if (enrollment.value) enrollment.value.itakPackageCertificateId = null;
    itakDownloaded.value = false;
    confirmingRevoke.value = false;
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    revokingPackage.value = false;
  }
}

// While the dialog is open, Core tells this tab when one of the user's TAK apps enrolls.
const appEnrolled = ref(false);
let certificates: Socket | null = null;

function listenForEnrollment(): void {
  certificates?.disconnect();
  certificates = connectRealtime("/my-tak-certificates");
  certificates.on("issued", ({ clientUid }: { clientUid: string | null }) => {
    // Downloading an iTAK package also issues a certificate; only a real enrollment counts here.
    if (clientUid?.startsWith("ITAK-PACKAGE-") !== true) {
      appEnrolled.value = true;
    }
  });
}

function stopListening(): void {
  certificates?.disconnect();
  certificates = null;
}

watch(
  () => enrollment.value !== null,
  (open) => {
    appEnrolled.value = false;
    if (open) {
      listenForEnrollment();
    } else {
      stopListening();
    }
  },
);
onBeforeUnmount(stopListening);

watch(client, () => {
  if (method.value === "qr" && !qrAvailable.value) method.value = "package";
});

async function create(): Promise<void> {
  creating.value = true;
  try {
    enrollment.value = await createTakEnrollment();
    method.value = enrollment.value.atakEnrollmentUrl === null ? "package" : "qr";
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

function close(): void {
  enrollment.value = null;
  client.value = "atak";
  method.value = "qr";
  itakDownloaded.value = false;
  emit("closed");
}
</script>

<template>
  <v-alert v-if="unavailable" type="info" density="compact" variant="tonal" class="mb-3">
    The TAK server is not enabled yet. Your organizers will tell you when it is.
  </v-alert>
  <v-btn color="primary" block :loading="creating" :disabled="unavailable" @click="create">{{ label }}</v-btn>

  <v-dialog :model-value="enrollment !== null" max-width="520" :fullscreen="xs" @update:model-value="close">
    <v-card v-if="enrollment">
      <v-card-title class="pt-4 px-6">Connect a TAK app</v-card-title>
      <div class="px-6 pb-3">
        <v-btn-toggle v-model="client" mandatory divided density="comfortable" class="w-100">
          <v-btn value="atak" class="flex-grow-1">Android · ATAK</v-btn>
          <v-btn value="itak" class="flex-grow-1">iPhone · iTAK</v-btn>
        </v-btn-toggle>
      </div>
      <v-tabs v-model="method" density="compact" grow>
        <v-tab v-if="qrAvailable" value="qr">QR code</v-tab>
        <v-tab value="package">Connection package</v-tab>
        <v-tab value="login">Login data</v-tab>
      </v-tabs>
      <v-divider />
      <v-card-text>
        <v-alert v-if="appEnrolled" type="success" density="compact" class="mb-4">
          Your TAK app is set up and received its certificate. You can close this dialog.
        </v-alert>
        <v-alert v-if="!qrAvailable" type="info" density="compact" class="mb-4">
          QR setup needs a publicly trusted TAK server certificate. Import the {{ client === "atak" ? "ATAK" : "iTAK" }}
          connection package instead so the app receives the required trust material.
        </v-alert>
        <v-alert v-if="showPasswordWarning" type="warning" density="compact" class="mb-4">
          You have no password yet. <RouterLink to="/account">Set one on your account page</RouterLink> to log in here,
          <template v-if="client === 'atak'">or use the ATAK QR code.</template>
        </v-alert>
        <v-window v-model="method">
          <v-window-item v-if="qrAvailable" value="qr">
            <template v-if="client === 'atak' && enrollment.atakEnrollmentUrl">
              <p class="text-body-medium mt-0 mb-3">Scan this code with the QR scanner in ATAK, or open the link on the phone with ATAK.</p>
              <div class="d-flex justify-center mb-3">
                <QrCode :value="enrollment.atakEnrollmentUrl" label="ATAK enrollment code" :size="220" />
              </div>
              <div class="d-flex justify-center">
                <v-btn :href="enrollment.atakEnrollmentUrl" variant="tonal" size="small">Open in ATAK</v-btn>
              </div>
              <p class="text-body-small text-medium-emphasis text-center mt-3 mb-0">
                <template v-if="enrollment.expiresAt">Valid until {{ dateFormat.format(new Date(enrollment.expiresAt)) }}.</template>
                <template v-else>Valid as long as you have TAK access.</template>
                Do not share it: it signs in as you.
              </p>
            </template>
            <template v-else-if="client === 'itak' && enrollment.itakQrString">
              <p class="text-body-medium mt-0 mb-3">Open iTAK's server QR scanner and scan this code. Then sign in with your OpenMeshTak login.</p>
              <div class="d-flex justify-center mb-3">
                <QrCode :value="enrollment.itakQrString" label="iTAK server code" :size="220" />
              </div>
              <v-table density="compact">
                <tbody>
                  <tr><td>Username</td><td><code>{{ enrollment.username }}</code></td></tr>
                  <tr><td>Password</td><td>Your OpenMeshTak password</td></tr>
                </tbody>
              </v-table>
            </template>
          </v-window-item>

          <v-window-item value="package">
            <template v-if="client === 'atak'">
              <p class="text-body-medium mt-0 mb-3">Download the ATAK connection package and import it. When ATAK asks, sign in with:</p>
              <v-table density="compact" class="mb-4">
                <tbody>
                  <tr><td>Username</td><td><code>{{ enrollment.username }}</code></td></tr>
                  <tr><td>Password</td><td>Your OpenMeshTak password</td></tr>
                </tbody>
              </v-table>
            </template>
            <template v-else-if="itakPackageIssued">
              <p class="text-body-medium mt-0 mb-3">
                Your iTAK package was downloaded and its certificate is still valid. Each package belongs to one device:
                to set up another iPhone or replace a lost file, revoke the old certificate first. The device using it is
                disconnected.
              </p>
              <v-btn color="error" variant="tonal" @click="confirmingRevoke = true">Revoke old iTAK certificate</v-btn>
            </template>
            <v-alert v-else type="warning" density="compact" class="mb-4">
              This personal iTAK package contains a newly issued client certificate and private key. Import it only on
              your device and do not share it. It configures the secure API port as <code>{{ enrollment.martiPort }}</code>.
            </v-alert>
            <div v-if="!itakPackageIssued" class="d-flex flex-wrap ga-2">
              <v-btn :href="packageHref" download color="primary" :prepend-icon="mdiDownload" @click="packageDownloaded">
                Download {{ client === "atak" ? "ATAK" : "iTAK" }} package
              </v-btn>
              <DownloadQrButton v-bind="downloadQrProps" />
            </div>
          </v-window-item>

          <v-window-item value="login">
            <p class="text-body-medium mt-0 mb-3">
              In {{ client === "atak" ? "ATAK" : "iTAK" }}, add a server manually and enter:
            </p>
            <v-table density="compact">
              <tbody>
                <tr><td>Address</td><td><code>{{ enrollment.hostName }}</code></td></tr>
                <tr><td>Port</td><td><code>{{ enrollment.streamingPort }}</code> (SSL)</td></tr>
                <tr v-if="enrollment.enrollmentPort !== 8446"><td>Enrollment port</td><td><code>{{ enrollment.enrollmentPort }}</code></td></tr>
                <tr v-if="enrollment.martiPort !== 8443"><td>Secure API port</td><td><code>{{ enrollment.martiPort }}</code></td></tr>
                <tr><td>Username</td><td><code>{{ enrollment.username }}</code></td></tr>
                <tr><td>Password</td><td>Your OpenMeshTak password</td></tr>
              </tbody>
            </v-table>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <ConfirmDialog
    v-model="confirmingRevoke"
    title="Revoke the old iTAK certificate?"
    confirm-label="Revoke"
    confirm-color="error"
    :loading="revokingPackage"
    @confirm="revokeItakPackage"
  >
    The iPhone that imported the earlier package loses its TAK connection and cannot reconnect with it.
  </ConfirmDialog>
</template>
