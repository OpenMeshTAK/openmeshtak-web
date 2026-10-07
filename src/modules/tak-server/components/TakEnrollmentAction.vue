<script setup lang="ts">
import { mdiDownload } from "@mdi/js";
import { computed, ref } from "vue";
import { useDisplay } from "vuetify";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";
import QrCode from "@/shared/components/QrCode.vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { createTakEnrollment, type TakEnrollmentDto } from "../tak-server.api";

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
const method = ref<"qr" | "package" | "login">("qr");
const session = useSession();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const needsPassword = computed(() => session.state.principal?.hasPassword === false);
const qrAvailable = computed(() => enrollment.value?.atakEnrollmentUrl !== null);

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
  method.value = "qr";
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
      <v-tabs v-model="method" density="compact" grow>
        <v-tab v-if="qrAvailable" value="qr">QR code</v-tab>
        <v-tab value="package">Connection package</v-tab>
        <v-tab value="login">Login data</v-tab>
      </v-tabs>
      <v-divider />
      <v-card-text>
        <v-alert v-if="!qrAvailable" type="info" density="compact" class="mb-4">
          QR enrollment needs a publicly trusted TAK server certificate. Import the connection package first so your app trusts this server.
        </v-alert>
        <v-alert v-if="needsPassword && method !== 'qr'" type="warning" density="compact" class="mb-4">
          You have no password yet. <RouterLink to="/account">Set one on your account page</RouterLink> to log in here,
          or use the QR code.
        </v-alert>
        <v-window v-model="method">
          <v-window-item v-if="enrollment.atakEnrollmentUrl" value="qr">
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
          </v-window-item>

          <v-window-item value="package">
            <p class="text-body-medium mt-0 mb-3">
              Download the connection package and import it in ATAK or iTAK. When the app asks, sign in with:
            </p>
            <v-table density="compact" class="mb-4">
              <tbody>
                <tr><td>Username</td><td><code>{{ enrollment.username }}</code></td></tr>
                <tr><td>Password</td><td>Your OpenMeshTak password</td></tr>
              </tbody>
            </v-table>
            <div class="d-flex flex-wrap ga-2">
              <v-btn href="/api/v1/me/tak-connection-package" download color="primary" :prepend-icon="mdiDownload">
                Download connection package
              </v-btn>
              <DownloadQrButton :request="{ kind: 'tak-connection-package' }" file-label="the connection package" />
            </div>
          </v-window-item>

          <v-window-item value="login">
            <p class="text-body-medium mt-0 mb-3">
              In ATAK or iTAK, add a server with certificate enrollment and enter:
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
</template>
