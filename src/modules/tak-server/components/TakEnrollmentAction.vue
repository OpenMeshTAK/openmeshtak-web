<script setup lang="ts">
import { mdiDownload } from "@mdi/js";
import { ref } from "vue";
import { useDisplay } from "vuetify";
import QrCode from "@/shared/components/QrCode.vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { createTakEnrollment, type TakEnrollmentDto } from "../tak-server.api";

/**
 * Enrolls a TAK app with the built-in TAK server: QR code for ATAK, the connection package and
 * manual login data. The enrollment password is single-use, valid for a few minutes and only kept
 * while the dialog is open; the account password never reaches the app.
 */
withDefaults(defineProps<{ label?: string }>(), { label: "Connect a TAK app" });
const emit = defineEmits<{ closed: [] }>();

const toast = useToast();
const { xs } = useDisplay();
const enrollment = ref<TakEnrollmentDto | null>(null);
const creating = ref(false);
const unavailable = ref(false);
const method = ref<"qr" | "package" | "login">("qr");
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

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
        <v-tab value="qr">QR code</v-tab>
        <v-tab value="package">Connection package</v-tab>
        <v-tab value="login">Login data</v-tab>
      </v-tabs>
      <v-divider />
      <v-card-text>
        <v-window v-model="method">
          <v-window-item value="qr">
            <p class="text-body-2 mb-3">Scan this code with the QR scanner in ATAK, or open the link on the phone with ATAK.</p>
            <div class="d-flex justify-center mb-3">
              <QrCode :value="enrollment.atakEnrollmentUrl" label="ATAK enrollment code" :size="220" />
            </div>
            <div class="d-flex justify-center">
              <v-btn :href="enrollment.atakEnrollmentUrl" variant="tonal" size="small">Open in ATAK</v-btn>
            </div>
          </v-window-item>

          <v-window-item value="package">
            <p class="text-body-2 mb-3">
              Download the connection package and import it in ATAK or iTAK. The package holds no password; when
              the app asks, sign in with:
            </p>
            <v-table density="compact" class="mb-4">
              <tbody>
                <tr><td>Username</td><td><code class="text-break">{{ enrollment.username }}</code></td></tr>
                <tr><td>Password</td><td><code>{{ enrollment.token }}</code></td></tr>
              </tbody>
            </v-table>
            <v-btn href="/api/v1/me/tak-connection-package" download color="primary" :prepend-icon="mdiDownload">
              Download connection package
            </v-btn>
          </v-window-item>

          <v-window-item value="login">
            <p class="text-body-2 mb-3">
              In ATAK or iTAK, add a server with certificate enrollment and enter:
            </p>
            <v-table density="compact">
              <tbody>
                <tr><td>Address</td><td><code>{{ enrollment.hostName }}</code></td></tr>
                <tr><td>Port</td><td><code>{{ enrollment.streamingPort }}</code> (SSL)</td></tr>
                <tr><td>Username</td><td><code class="text-break">{{ enrollment.username }}</code></td></tr>
                <tr><td>Password</td><td><code>{{ enrollment.token }}</code></td></tr>
              </tbody>
            </v-table>
          </v-window-item>
        </v-window>
        <p class="text-caption text-medium-emphasis mt-4 mb-0">
          Works once and expires at {{ timeFormat.format(new Date(enrollment.expiresAt)) }}.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
