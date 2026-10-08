<script setup lang="ts">
import { mdiCertificate } from "@mdi/js";
import { computed, ref, watch } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import {
  addTakServerCertificate,
  removeTakServerCertificate,
  useTakCertificateFiles,
  type TakAcmeSettingsDto,
  type TakServerSettingsDto,
} from "../tak-server.api";
import PemUploadDialog from "./PemUploadDialog.vue";
import TakAcmeSettingsForm from "./TakAcmeSettingsForm.vue";

/**
 * The TLS certificate of the TAK ports and where it comes from: the OpenMeshTak CA, Let's Encrypt
 * through ACME, the reverse proxy's certificate files, or an uploaded publicly trusted certificate. Only one source is active at a time.
 */
const props = defineProps<{ settings: TakServerSettingsDto; acme: TakAcmeSettingsDto }>();
const emit = defineEmits<{ changed: []; acmeChanged: [settings: TakAcmeSettingsDto] }>();
const toast = useToast();

type Source = "ca" | "acme" | "files" | "upload";

const sourceLabels: Record<Source, string> = {
  ca: "OpenMeshTak CA",
  acme: "Let's Encrypt (automatic)",
  files: "Reverse proxy files",
  upload: "Uploaded certificate",
};

const certificate = computed(() => props.settings.serverCertificate);
const activeSource = computed<Source>(() => {
  if (props.acme.enabled || certificate.value?.source === "acme") {
    return "acme";
  }
  if (props.settings.certificateFiles !== null || certificate.value?.source === "file") {
    return "files";
  }
  return certificate.value?.source === "added" ? "upload" : "ca";
});

/** Certbot's layout is the common case, so it is the starting suggestion. */
function filesOf(settings: TakServerSettingsDto) {
  const host = settings.hostName ?? "tak.example.org";
  return settings.certificateFiles ?? { certificateFile: `live/${host}/fullchain.pem`, keyFile: `live/${host}/privkey.pem` };
}
const files = ref(filesOf(props.settings));
const fileErrors = ref<Record<string, string>>({});
watch(
  () => props.settings,
  (settings) => {
    files.value = filesOf(settings);
  },
);

async function useFiles(): Promise<void> {
  saving.value = true;
  fileErrors.value = {};
  try {
    await useTakCertificateFiles(files.value);
    toast.success("The TAK server now uses your reverse proxy's certificate.");
    emit("changed");
  } catch (caught: unknown) {
    fileErrors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}
const source = ref<Source>(activeSource.value);
watch(activeSource, (value) => {
  source.value = value;
});

const dialogOpen = ref(false);
const switchingToCa = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

async function upload(chainPem: string, keyPem: string): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    await addTakServerCertificate(chainPem, keyPem);
    dialogOpen.value = false;
    toast.success("Certificate uploaded. The TAK server uses it now.");
    emit("changed");
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}

async function useCa(): Promise<void> {
  switchingToCa.value = false;
  try {
    await removeTakServerCertificate();
    toast.success("The TAK server now uses a certificate from the OpenMeshTak CA.");
    emit("changed");
  } catch (caught: unknown) {
    toast.error(caught);
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-3">
      <v-icon :icon="mdiCertificate" class="mr-2" />
      <div class="d-flex align-center ga-1 flex-grow-1">
        <span class="text-title-medium font-weight-medium">Server certificate</span>
        <InfoHint label="About the server certificate">
          The certificate the TAK server shows to ATAK and iTAK when they connect, so the apps know
          they talk to your server. There is only one, for the TAK host name. The certificates of
          members' apps are separate and always come from the OpenMeshTak CA.
        </InfoHint>
      </div>
      <v-chip size="small" variant="tonal" :color="activeSource === 'ca' ? undefined : 'success'">
        {{ sourceLabels[activeSource] }}
      </v-chip>
    </div>
    <template v-if="certificate">
      <div class="text-body-medium">{{ certificate.subject }}</div>
      <div class="text-body-small text-medium-emphasis">
        For {{ certificate.hostName }} · valid until {{ dateFormat.format(new Date(certificate.notAfter)) }}
      </div>
      <div class="text-body-small text-medium-emphasis text-truncate">SHA-256 {{ certificate.fingerprintSha256 }}</div>
    </template>
    <p v-else class="text-body-medium text-medium-emphasis my-0">Issued by the OpenMeshTak CA when the TAK server starts.</p>

    <div class="d-flex align-center ga-1 mt-5 mb-2">
      <span class="text-body-medium font-weight-medium">Source</span>
      <InfoHint label="About the certificate sources">
        <p class="mb-2">
          <strong>OpenMeshTak CA:</strong> works without any setup, but phones do not trust it on their
          own. The QR codes for ATAK and iTAK need one of the other sources.
        </p>
        <p class="mb-2">
          <strong>Let's Encrypt (automatic):</strong> OpenMeshTak requests a free, publicly trusted
          certificate and renews it by itself, either through the Web address (TAK and Web share one host
          name) or through a DNS record at Cloudflare.
        </p>
        <p class="mb-2">
          <strong>Reverse proxy files:</strong> the certificate your reverse proxy already has for the
          TAK host name, read from its mounted certificate directory. OpenMeshTak picks up renewals by
          itself.
        </p>
        <p class="mb-0">
          <strong>Uploaded certificate:</strong> a publicly trusted certificate you already have. You
          must upload the renewed one before it expires.
        </p>
      </InfoHint>
    </div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn-toggle v-model="source" mandatory divided variant="outlined" density="comfortable" class="flex-wrap">
        <v-btn value="ca">OpenMeshTak CA</v-btn>
        <v-btn value="acme">Let's Encrypt (automatic)</v-btn>
        <v-btn value="files">Reverse proxy files</v-btn>
        <v-btn value="upload">Upload certificate</v-btn>
      </v-btn-toggle>
      <InfoHint v-if="source === 'ca'" tone="warning" label="Limits of the OpenMeshTak CA">
        Phones must install the OpenMeshTak CA before they trust the server, and ATAK's QR enrollment
        does not work.
      </InfoHint>
      <InfoHint v-else-if="source === 'upload'" tone="warning" label="Uploaded certificates are not renewed">
        OpenMeshTak cannot renew an uploaded certificate. Upload the renewed one before it expires;
        otherwise the TAK server falls back to the OpenMeshTak CA and QR enrollment stops working.
      </InfoHint>
    </div>

    <v-alert v-if="source !== 'ca' && settings.hostName === null" type="warning" variant="tonal" density="compact" class="mb-4">
      Save the TAK host name first.
    </v-alert>

    <div v-if="source === 'ca' && activeSource !== 'ca'" class="d-flex justify-end">
      <v-btn color="primary" @click="switchingToCa = true">Use OpenMeshTak CA</v-btn>
    </div>

    <TakAcmeSettingsForm
      v-else-if="source === 'acme'"
      :settings="acme"
      :host-name="settings.hostName"
      @changed="emit('acmeChanged', $event)"
    />

    <div v-else-if="source === 'files'">
      <p class="text-body-medium mt-0 mb-3">
        Mount your reverse proxy's certificate directory read-only at
        <code>{{ settings.certificateDirectory }}</code> (see <code>docker-compose.yml</code>), then enter
        the files relative to it.
      </p>
      <v-row dense>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="files.certificateFile"
            label="Certificate chain file"
            :error-messages="messagesFor(fileErrors, 'certificateFile')"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="files.keyFile" label="Private key file" :error-messages="messagesFor(fileErrors, 'keyFile')" />
        </v-col>
      </v-row>
      <div class="d-flex justify-end">
        <v-btn color="primary" :loading="saving" :disabled="settings.hostName === null" @click="useFiles">
          {{ activeSource === "files" ? "Save and reload" : "Use these files" }}
        </v-btn>
      </div>
    </div>

    <div v-else-if="source === 'upload'" class="d-flex justify-end">
      <v-btn color="primary" :disabled="settings.hostName === null" @click="dialogOpen = true">
        {{ activeSource === "upload" ? "Replace certificate" : "Upload certificate" }}
      </v-btn>
    </div>

    <PemUploadDialog
      v-model="dialogOpen"
      title="Upload server certificate"
      :text="`Paste or load the full chain (fullchain.pem) and private key (privkey.pem) for ${settings.hostName ?? 'the host name'}. The chain must lead to a publicly trusted root. Uploading stops Let's Encrypt automation. Requires a recent sign-in.`"
      certificate-label="Full certificate chain (PEM)"
      :saving="saving"
      :error="error"
      @submit="upload"
    />
    <ConfirmDialog
      :model-value="switchingToCa"
      title="Switch to the OpenMeshTak CA?"
      confirm-label="Switch"
      confirm-color="error"
      @update:model-value="switchingToCa = false"
      @confirm="useCa"
    >
      The public certificate is removed and Let's Encrypt automation stops. Phones then need the
      OpenMeshTak CA to trust the server, and ATAK's QR enrollment no longer works.
    </ConfirmDialog>
  </v-card>
</template>
