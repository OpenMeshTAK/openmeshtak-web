<script setup lang="ts">
import { mdiCertificate } from "@mdi/js";
import { computed, ref, watch } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import {
  addTakServerCertificate,
  removeTakServerCertificate,
  type TakAcmeSettingsDto,
  type TakServerSettingsDto,
} from "../tak-server.api";
import PemUploadDialog from "./PemUploadDialog.vue";
import TakAcmeSettingsForm from "./TakAcmeSettingsForm.vue";

/**
 * The TLS certificate of the TAK ports and where it comes from: the OpenMeshTak CA, Let's Encrypt
 * through ACME, or an uploaded publicly trusted certificate. Only one source is active at a time.
 */
const props = defineProps<{ settings: TakServerSettingsDto; acme: TakAcmeSettingsDto }>();
const emit = defineEmits<{ changed: []; acmeChanged: [settings: TakAcmeSettingsDto] }>();
const toast = useToast();

type Source = "ca" | "acme" | "upload";

const sourceLabels: Record<Source, string> = {
  ca: "OpenMeshTak CA",
  acme: "Let's Encrypt (automatic)",
  upload: "Uploaded certificate",
};

const certificate = computed(() => props.settings.serverCertificate);
const activeSource = computed<Source>(() => {
  if (props.acme.enabled || certificate.value?.source === "acme") {
    return "acme";
  }
  return certificate.value?.source === "added" ? "upload" : "ca";
});
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
        <span class="text-subtitle-1 font-weight-medium">Server certificate</span>
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
      <div class="text-body-2">{{ certificate.subject }}</div>
      <div class="text-caption text-medium-emphasis">
        For {{ certificate.hostName }} · valid until {{ dateFormat.format(new Date(certificate.notAfter)) }}
      </div>
      <div class="text-caption text-medium-emphasis text-truncate">SHA-256 {{ certificate.fingerprintSha256 }}</div>
    </template>
    <p v-else class="text-body-2 text-medium-emphasis mb-0">Issued by the OpenMeshTak CA when the TAK server starts.</p>

    <div class="d-flex align-center ga-1 mt-5 mb-2">
      <span class="text-body-2 font-weight-medium">Source</span>
      <InfoHint label="About the certificate sources">
        <p class="mb-2">
          <strong>OpenMeshTak CA:</strong> works without any setup, but phones do not trust it on their
          own. ATAK's QR enrollment needs one of the other two sources.
        </p>
        <p class="mb-2">
          <strong>Let's Encrypt (automatic):</strong> OpenMeshTak requests a free, publicly trusted
          certificate and renews it by itself. Needs the host name's DNS zone at Cloudflare.
        </p>
        <p class="mb-0">
          <strong>Uploaded certificate:</strong> a publicly trusted certificate you already have, e.g.
          from CloudPanel or certbot. You must upload the renewed one before it expires.
        </p>
      </InfoHint>
    </div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn-toggle v-model="source" mandatory divided variant="outlined" density="comfortable" class="flex-wrap">
        <v-btn value="ca">OpenMeshTak CA</v-btn>
        <v-btn value="acme">Let's Encrypt (automatic)</v-btn>
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
