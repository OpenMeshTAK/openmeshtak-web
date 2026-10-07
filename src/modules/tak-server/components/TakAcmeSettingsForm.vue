<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { computed, ref, watch } from "vue";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import {
  renewTakAcmeCertificate,
  saveTakAcmeSettings,
  type TakAcmeSettingsChanges,
  type TakAcmeSettingsDto,
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
const removeApiToken = ref(false);
const saving = ref(false);
const renewing = ref(false);
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
  removeApiToken.value = false;
}

watch(
  () => props.settings,
  (settings) => {
    form.value = formOf(settings);
  },
);

async function save(): Promise<void> {
  saving.value = true;
  errors.value = {};
  const apiToken = removeApiToken.value ? { apiToken: null } : newApiToken.value === "" ? {} : { apiToken: newApiToken.value };
  try {
    show(
      await saveTakAcmeSettings(props.settings.version, {
        ...form.value,
        email: form.value.email?.trim() || null,
        cloudflareZoneId: form.value.cloudflareZoneId?.trim() || null,
        ...apiToken,
      }),
    );
    toast.success("Let's Encrypt is set up. The certificate is requested in the background.");
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
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
              text="How Let's Encrypt checks that you own the host name. DNS-01 creates a short-lived DNS record, so no web port has to be reachable and a web server such as CloudPanel on port 80 is not affected."
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
      <v-col cols="12">
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
      <v-col cols="12">
        <v-text-field
          v-model="newApiToken"
          type="password"
          autocomplete="new-password"
          :label="settings.apiTokenSet ? 'New Cloudflare API token (leave empty to keep)' : 'Cloudflare API token'"
          :disabled="removeApiToken"
          :error-messages="messagesFor(errors, 'apiToken')"
        >
          <template #append-inner>
            <InfoHint label="About the API token" text="Use a token limited to DNS Write for this zone. It is encrypted and never shown again." />
          </template>
        </v-text-field>
        <v-checkbox
          v-if="settings.apiTokenSet"
          v-model="removeApiToken"
          label="Remove stored token"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>
    <v-alert v-if="settings.lastError" type="error" variant="tonal" density="compact" class="mt-2">
      {{ settings.lastError }}
    </v-alert>
    <p v-else-if="settings.lastSuccessAt" class="text-body-small text-medium-emphasis mt-2 mb-0">
      Last renewed {{ dateFormat.format(new Date(settings.lastSuccessAt)) }}.
    </p>
    <div class="d-flex justify-end ga-2 mt-4">
      <v-btn v-if="settings.enabled" variant="tonal" :loading="renewing" @click="renew">Renew now</v-btn>
      <v-btn color="primary" :loading="saving" :disabled="hostName === null" @click="save">
        {{ settings.enabled ? "Save" : "Use Let's Encrypt" }}
      </v-btn>
    </div>
  </div>
</template>
