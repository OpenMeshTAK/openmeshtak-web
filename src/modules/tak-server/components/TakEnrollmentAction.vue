<script setup lang="ts">
import { mdiAndroid, mdiApple, mdiClose, mdiDownload, mdiMicrosoftWindows } from "@mdi/js";
import type { Socket } from "socket.io-client";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import QrCode from "@/shared/components/QrCode.vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { connectRealtime } from "@/shared/realtime/realtime";
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
type TakClient = "atak" | "itak" | "wintak";
const client = ref<TakClient>("atak");
const clientOptions = [
  { value: "atak", app: "ATAK", platform: "Android", icon: mdiAndroid },
  { value: "itak", app: "iTAK", platform: "iPhone", icon: mdiApple },
  { value: "wintak", app: "WinTAK", platform: "Windows", icon: mdiMicrosoftWindows },
] as const;
const appName = computed(() => clientOptions.find(({ value }) => value === client.value)?.app ?? "ATAK");
const packageHrefs = {
  atak: "/api/v1/me/tak-connection-package",
  itak: "/api/v1/me/itak-connection-package",
  wintak: "/api/v1/me/wintak-connection-package",
} as const;
const packageUidPrefixes = { itak: "ITAK-PACKAGE-", wintak: "WINTAK-PACKAGE-" } as const;
const method = ref<"qr" | "package" | "login">("qr");
const session = useSession();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const needsPassword = computed(() => session.state.principal?.hasPassword === false);
// WinTAK has neither a QR scanner nor a working login enrollment; it only imports its package.
const qrValue = computed(() => {
  if (client.value === "atak") return enrollment.value?.atakEnrollmentUrl;
  return client.value === "itak" ? enrollment.value?.itakQrString : null;
});
const qrAvailable = computed(() => qrValue.value !== null && qrValue.value !== undefined);
const packageHref = computed(() => packageHrefs[client.value]);
const downloadQrProps = computed(() => {
  const common = {
    request: { kind: `${client.value === "atak" ? "tak" : client.value}-connection-package` as const },
    fileLabel: `the ${appName.value} connection package`,
  };
  return client.value !== "atak"
    ? { ...common, secretNotice: "This package contains your private TAK client key. Do not share the QR code or downloaded file." }
    : common;
});
const showPasswordWarning = computed(
  () => needsPassword.value && (method.value === "login" || (client.value === "itak" && method.value === "qr")),
);

// iTAK and WinTAK packages carry a ready-made key; Core revokes one that no app imports in time.
const packageClient = computed(() => client.value !== "atak");

// While the dialog is open, Core tells this tab when one of the user's TAK apps enrolls.
const appEnrolled = ref(false);
let certificates: Socket | null = null;

function listenForEnrollment(): void {
  certificates?.disconnect();
  certificates = connectRealtime("/my-tak-certificates");
  certificates.on("issued", ({ clientUid }: { clientUid: string | null }) => {
    // Downloading an iTAK or WinTAK package also issues a certificate; only a real enrollment counts here.
    if (!Object.values(packageUidPrefixes).some((prefix) => clientUid?.startsWith(prefix) === true)) {
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
  if ((method.value === "qr" && !qrAvailable.value) || client.value === "wintak") method.value = "package";
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
      <v-card-title class="d-flex align-center pt-4 pl-6 pr-3">
        <span class="flex-grow-1">Connect a TAK app</span>
        <v-btn :icon="mdiClose" variant="text" size="small" aria-label="Close" @click="close" />
      </v-card-title>
      <div class="px-6 pb-3">
        <div class="client-choice" role="radiogroup" aria-label="TAK app">
          <v-btn
            v-for="option in clientOptions"
            :key="option.value"
            role="radio"
            :aria-checked="client === option.value"
            variant="tonal"
            :color="client === option.value ? 'primary' : undefined"
            :prepend-icon="option.icon"
            height="56"
            class="client-choice__option"
            @click="client = option.value"
          >
            <span class="d-flex flex-column align-start text-none">
              <span class="text-body-large font-weight-medium">{{ option.app }}</span>
              <span class="text-body-small text-medium-emphasis">{{ option.platform }}</span>
            </span>
          </v-btn>
        </div>
      </div>
      <v-tabs v-model="method" density="compact" grow>
        <v-tab v-if="qrAvailable" value="qr">QR code</v-tab>
        <v-tab value="package">Connection package</v-tab>
        <v-tab v-if="client !== 'wintak'" value="login">Login data</v-tab>
      </v-tabs>
      <v-divider />
      <v-card-text>
        <v-alert v-if="appEnrolled" type="success" density="compact" class="mb-4">
          Your TAK app is set up and received its certificate. You can close this dialog.
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
            <p v-else-if="client === 'wintak'" class="d-flex align-center ga-1 text-body-medium mt-0 mb-3">
              Download the WinTAK package and import it in WinTAK.
              <InfoHint label="How to import in WinTAK">
                In WinTAK, open the main menu, then Import Manager → Import Files, and choose the downloaded file. WinTAK
                cannot sign in with a username and password, so the package brings its own certificate.
              </InfoHint>
            </p>
            <div class="d-flex flex-wrap ga-2">
              <v-btn :href="packageHref" download color="primary" :prepend-icon="mdiDownload">
                Download {{ appName }} package
              </v-btn>
              <DownloadQrButton v-if="client !== 'wintak'" v-bind="downloadQrProps" />
            </div>
            <p v-if="packageClient" class="text-body-small text-medium-emphasis mt-3 mb-0">
              Each download is a new login for one device. Import it within {{ enrollment.unusedPackageHours }} hours,
              otherwise it stops working.
            </p>
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
    </v-card>
  </v-dialog>
</template>

<style scoped>
.client-choice {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

/* Three app buttons do not fit side by side on a phone. */
@media (max-width: 599px) {
  .client-choice {
    grid-template-columns: 1fr;
  }
}

.client-choice__option {
  justify-content: flex-start;
}
</style>
