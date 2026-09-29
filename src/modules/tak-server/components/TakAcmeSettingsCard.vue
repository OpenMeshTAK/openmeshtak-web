<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import {
  renewTakAcmeCertificate,
  saveTakAcmeSettings,
  type TakAcmeSettingsChanges,
  type TakAcmeSettingsDto,
} from "../tak-server.api";

/** Automatic public TAK certificate settings. Provider credentials remain write-only. */
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
    enabled: settings.enabled,
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
    toast.success("Automatic certificate settings saved.");
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
    toast.success("The public TAK certificate was renewed.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    renewing.value = false;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-4">
      <div class="flex-grow-1">
        <div class="text-subtitle-1 font-weight-medium">Automatic public certificate</div>
        <div class="text-body-2 text-medium-emphasis">Let's Encrypt through an ACME challenge solver.</div>
      </div>
      <v-switch v-model="form.enabled" color="primary" inset hide-details label="Enabled" />
    </div>
    <v-alert v-if="hostName === null" type="warning" variant="tonal" density="compact" class="mb-4">
      Save a public TAK host name before enabling certificate automation.
    </v-alert>
    <v-row dense>
      <v-col cols="12">
        <v-select
          v-model="solverKey"
          :items="solverItems"
          label="Challenge solver"
          hint="This Core version exposes only implemented solvers. More challenge types and providers can be added independently."
          persistent-hint
          :error-messages="messagesFor(errors, 'challengeType')"
        />
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="form.email"
          type="email"
          label="ACME contact email"
          :error-messages="messagesFor(errors, 'email')"
        />
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="form.cloudflareZoneId"
          label="Cloudflare zone ID"
          hint="The 32-character ID of the zone containing the TAK host name."
          persistent-hint
          :error-messages="messagesFor(errors, 'cloudflareZoneId')"
        />
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="newApiToken"
          type="password"
          autocomplete="new-password"
          :label="settings.apiTokenSet ? 'New Cloudflare API token (leave empty to keep)' : 'Cloudflare API token'"
          hint="Use a token limited to DNS Write for this zone. It is encrypted and never shown again."
          persistent-hint
          :disabled="removeApiToken"
          :error-messages="messagesFor(errors, 'apiToken')"
        />
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
    <p v-else-if="settings.lastSuccessAt" class="text-caption text-medium-emphasis mt-2 mb-0">
      Last renewed {{ dateFormat.format(new Date(settings.lastSuccessAt)) }}.
    </p>
    <div class="d-flex justify-end ga-2 mt-4">
      <v-btn
        variant="tonal"
        :loading="renewing"
        :disabled="!settings.enabled"
        @click="renew"
      >
        Renew now
      </v-btn>
      <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
    </div>
  </v-card>
</template>
