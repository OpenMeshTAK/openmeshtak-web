<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { computed, ref, watch } from "vue";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import {
  renewTakAcmeCertificate,
  saveTakAcmeSettings,
  testTakAcmeSetup,
  type TakAcmeSettingsChanges,
  type TakAcmeSettingsDto,
  type TakAcmeTestResultDto,
} from "../tak-server.api";

/**
 * ACME settings inside the server certificate card. Choosing this source is what enables
 * automation, so saving always turns it on. Provider credentials remain write-only.
 */
const props = defineProps<{ settings: TakAcmeSettingsDto; hostName: string | null }>();
const emit = defineEmits<{ changed: [settings: TakAcmeSettingsDto] }>();
const toast = useToast();

const form = ref<TakAcmeSettingsChanges>(formOf(props.settings));
const newApiToken = ref("");
const confirmRemoveApiToken = ref(false);
const saving = ref(false);
const renewing = ref(false);
const testing = ref(false);
const testResult = ref<TakAcmeTestResultDto | null>(null);
const errors = ref<Record<string, string>>({});
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const solverKey = computed({
  get: () => `${form.value.challengeType}/${form.value.provider}`,
  set: (key: string) => {
    const solver = props.settings.availableSolvers.find((candidate) => `${candidate.challengeType}/${candidate.provider}` === key);
    if (solver !== undefined) {
      form.value.challengeType = solver.challengeType;
      form.value.provider = solver.provider;
    }
  },
});
/** Only the Cloudflare solver needs a zone and a token; HTTP-01 works through the Web address. */
const usesCloudflare = computed(() => form.value.provider === "cloudflare");
const solverItems = computed(() =>
  props.settings.availableSolvers.map((solver) => ({
    title: solver.label,
    value: `${solver.challengeType}/${solver.provider}`,
  })),
);

function formOf(settings: TakAcmeSettingsDto): TakAcmeSettingsChanges {
  return {
    enabled: true,
    email: settings.email,
    challengeType: settings.challengeType,
    provider: settings.provider,
    cloudflareZoneId: settings.cloudflareZoneId,
  };
}

function show(settings: TakAcmeSettingsDto): void {
  emit("changed", settings);
  form.value = formOf(settings);
  newApiToken.value = "";
}

watch(
  () => props.settings,
  (settings) => {
    form.value = formOf(settings);
  },
);

/** Stores the form; `enabled` decides whether Core starts requesting the real certificate. */
async function persist(enabled: boolean): Promise<TakAcmeSettingsDto> {
  const apiToken = newApiToken.value === "" ? {} : { apiToken: newApiToken.value };
  const saved = await saveTakAcmeSettings(props.settings.version, {
    ...form.value,
    enabled,
    email: form.value.email?.trim() || null,
    cloudflareZoneId: form.value.cloudflareZoneId?.trim() || null,
    ...apiToken,
  });
  show(saved);
  return saved;
}

async function save(): Promise<void> {
  saving.value = true;
  errors.value = {};
  try {
    await persist(true);
    toast.success("Let's Encrypt is set up. The certificate is requested in the background.");
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

/** Saves without switching Let's Encrypt on, then tries the setup against its staging service. */
async function testSetup(): Promise<void> {
  testing.value = true;
  errors.value = {};
  testResult.value = null;
  try {
    await persist(props.settings.enabled);
    testResult.value = await testTakAcmeSetup();
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    testing.value = false;
  }
}

/** Removes the stored Cloudflare token right away, keeping the other stored settings unchanged. */
async function removeApiToken(): Promise<void> {
  confirmRemoveApiToken.value = false;
  try {
    show(await saveTakAcmeSettings(props.settings.version, { ...formOf(props.settings), enabled: props.settings.enabled, apiToken: null }));
    toast.success("The Cloudflare API token was removed.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function renew(): Promise<void> {
  renewing.value = true;
  try {
    show(await renewTakAcmeCertificate());
    toast.success("The Let's Encrypt certificate was renewed.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    renewing.value = false;
  }
}
</script>

<template>
  <div>
    <v-row dense>
      <v-col cols="12">
        <v-select
          v-model="solverKey"
          :items="solverItems"
          label="Challenge solver"
          :error-messages="messagesFor(errors, 'challengeType')"
        >
          <template #append-inner>
            <InfoHint
              label="About the challenge solver"
              text="How Let's Encrypt checks that you own the host name. HTTP-01 answers through the Web address, so it needs no account at a DNS provider, but the TAK host name must be the Web host name and port 80 must reach your reverse proxy. DNS-01 creates a short-lived DNS record at Cloudflare and needs no open web port."
            />
          </template>
        </v-select>
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="form.email"
          type="email"
          label="ACME contact email"
          :error-messages="messagesFor(errors, 'email')"
        >
          <template #append-inner>
            <InfoHint label="About the contact email" text="Required by Let's Encrypt for the account; it writes here only about problems with it." />
          </template>
        </v-text-field>
      </v-col>
      <v-col v-if="usesCloudflare" cols="12">
        <v-text-field
          v-model="form.cloudflareZoneId"
          label="Cloudflare zone ID"
          :error-messages="messagesFor(errors, 'cloudflareZoneId')"
        >
          <template #append-inner>
            <InfoHint
              label="About the Cloudflare zone ID"
              text="The 32-character ID of the zone containing the TAK host name, shown on the zone's overview page in Cloudflare."
            />
          </template>
        </v-text-field>
      </v-col>
      <v-col v-if="usesCloudflare" cols="12">
        <v-text-field
          v-model="newApiToken"
          type="password"
          autocomplete="new-password"
          :label="settings.apiTokenSet ? 'New Cloudflare API token (leave empty to keep)' : 'Cloudflare API token'"
          :error-messages="messagesFor(errors, 'apiToken')"
        >
          <template #append-inner>
            <v-icon
              v-if="settings.apiTokenSet && newApiToken === ''"
              :icon="mdiClose"
              aria-label="Remove stored token"
              class="mr-1"
              @click="confirmRemoveApiToken = true"
            />
            <InfoHint label="About the API token" text="Use a token limited to DNS Write for this zone. It is encrypted and never shown again." />
          </template>
        </v-text-field>
      </v-col>
    </v-row>
    <v-alert v-if="settings.lastError" type="error" variant="tonal" density="compact" class="mt-2">
      {{ settings.lastError }}
    </v-alert>
    <p v-else-if="settings.lastSuccessAt" class="text-body-small text-medium-emphasis mt-2 mb-0">
      Last renewed {{ dateFormat.format(new Date(settings.lastSuccessAt)) }}.
    </p>
    <v-alert v-if="testResult" :type="testResult.succeeded ? 'success' : 'error'" variant="tonal" density="compact" class="mt-2">
      {{ testResult.message }}
    </v-alert>
    <div class="d-flex justify-end flex-wrap ga-2 mt-4">
      <div class="d-flex align-center">
        <v-btn variant="text" :loading="testing" :disabled="hostName === null" @click="testSetup">Test setup</v-btn>
        <InfoHint
          label="About the setup test"
          text="Saves the form and runs it against Let's Encrypt's test service. Nothing is installed and the limits of the real service are not touched, so you can try until it works."
        />
      </div>
      <v-btn v-if="settings.enabled" variant="tonal" :loading="renewing" @click="renew">Renew now</v-btn>
      <v-btn color="primary" :loading="saving" :disabled="hostName === null" @click="save">
        {{ settings.enabled ? "Save" : "Use Let's Encrypt" }}
      </v-btn>
    </div>
    <ConfirmDialog
      :model-value="confirmRemoveApiToken"
      title="Remove the stored Cloudflare API token?"
      confirm-label="Remove"
      confirm-color="error"
      @update:model-value="confirmRemoveApiToken = false"
      @confirm="removeApiToken"
    >
      Let's Encrypt can then no longer renew the certificate through Cloudflare until you enter a new token.
    </ConfirmDialog>
  </div>
</template>
