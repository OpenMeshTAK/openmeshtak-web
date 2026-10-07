<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { computed, ref, watch } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { ApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { saveTakServerSettings, type TakServerSettingsChanges, type TakServerSettingsDto } from "../tak-server.api";

/** Host name, ports and certificate lifetime of the built-in TAK server. */
const props = defineProps<{ settings: TakServerSettingsDto }>();
const emit = defineEmits<{ saved: [settings: TakServerSettingsDto] }>();
const toast = useToast();

const form = ref<TakServerSettingsChanges>(formOf(props.settings));
const saving = ref(false);
const errors = ref<Record<string, string>>({});
/** Core decides when an address or port change needs confirmation; the card only asks then. */
const confirming = ref(false);
const notifyAffectedUsers = ref(true);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function needsEndpointConfirmation(caught: unknown): boolean {
  return caught instanceof ApiProblem && caught.errors.some(({ code }) => code === "ENDPOINT_CHANGE_CONFIRMATION_REQUIRED");
}

/**
 * Non-standard public ports change how devices connect. ATAK Quick Connect expects enrollment on
 * 8446 and CoT on 8089, so changing those breaks the usual setup; a different Data Package port
 * reaches ATAK through the enrollment profile, which sets ATAK's `apiSecureServerPort`.
 */
const quickConnectChanged = computed(() => form.value.enrollmentPort !== 8446 || form.value.streamingPort !== 8089);
const martiChanged = computed(() => form.value.martiPort !== 8443);

function formOf(settings: TakServerSettingsDto): TakServerSettingsChanges {
  return {
    enabled: settings.enabled,
    hostName: settings.hostName,
    enrollmentPort: settings.enrollmentPort,
    martiPort: settings.martiPort,
    streamingPort: settings.streamingPort,
    clientCertificateDays: settings.clientCertificateDays,
  };
}

watch(
  () => props.settings,
  (settings) => {
    form.value = formOf(settings);
  },
);

async function save(endpointChange?: { notifyAffectedUsers: boolean }): Promise<void> {
  saving.value = true;
  errors.value = {};
  try {
    const saved = await saveTakServerSettings(props.settings.version, {
      ...form.value,
      hostName: form.value.hostName?.trim() || null,
      ...(endpointChange === undefined ? {} : { endpointChange }),
    });
    toast.success(saved.enabled ? "TAK server settings saved. The listeners restart now." : "TAK server settings saved.");
    emit("saved", saved);
  } catch (caught: unknown) {
    if (needsEndpointConfirmation(caught)) {
      confirming.value = true;
      return;
    }
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

function confirmEndpointChange(): void {
  confirming.value = false;
  void save({ notifyAffectedUsers: notifyAffectedUsers.value });
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-4">
      <div class="flex-grow-1">
        <div class="text-title-medium font-weight-medium">Server</div>
        <div class="text-body-medium text-medium-emphasis">
          Public ports that devices connect to directly, not through the Web proxy. QR codes and profiles use them.
        </div>
      </div>
      <v-switch v-model="form.enabled" class="flex-grow-0 flex-shrink-0 ml-4 text-no-wrap" color="primary" inset hide-details label="Enabled" />
    </div>
    <v-alert
      v-if="props.settings.clientCertificatesToReEnroll > 0 && props.settings.endpointChangedAt !== null"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ props.settings.clientCertificatesToReEnroll }} enrolled
      {{ props.settings.clientCertificatesToReEnroll === 1 ? "app was" : "apps were" }} set up before the address or ports
      changed on {{ dateFormat.format(new Date(props.settings.endpointChangedAt)) }}. They cannot connect until their users
      connect them again. The certificate list marks them.
    </v-alert>
    <v-row>
      <v-col cols="12">
        <v-text-field
          v-model="form.hostName"
          label="Public host name"
          :error-messages="messagesFor(errors, 'hostName')"
        >
          <template #append-inner>
            <InfoHint label="About public host name" text="Name or IPv4 address that phones reach, e.g. tak.example.org" />
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field v-model.number="form.enrollmentPort" type="number" label="Enrollment port" :error-messages="messagesFor(errors, 'enrollmentPort')" />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field v-model.number="form.martiPort" type="number" label="Data Package port" :error-messages="messagesFor(errors, 'martiPort')" />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field v-model.number="form.streamingPort" type="number" label="Streaming port" :error-messages="messagesFor(errors, 'streamingPort')" />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model.number="form.clientCertificateDays"
          type="number"
          label="Client certificate lifetime"
          suffix="days"
          :error-messages="messagesFor(errors, 'clientCertificateDays')"
        />
      </v-col>
    </v-row>
    <div class="d-flex justify-end mt-2">
      <v-btn color="primary" :loading="saving" @click="save()">Save</v-btn>
    </div>
    <ConfirmDialog v-model="confirming" title="Change how devices connect?" confirm-label="Save" @confirm="confirmEndpointChange">
      <p v-if="quickConnectChanged" class="mb-2">
        ATAK Quick Connect expects enrollment on 8446 and streaming on 8089. With other ports, participants must enter them
        by hand. Prefer a separate public address over changing them.
      </p>
      <p v-if="martiChanged" class="mb-2">
        ATAK learns the Data Package port from its enrollment profile; the setting applies to every server in the app.
      </p>
      <p v-if="quickConnectChanged || martiChanged" class="mb-2">Publish the same ports in Docker before you save.</p>
      <template v-if="props.settings.validClientCertificates > 0">
        <p class="mb-2">
          {{ props.settings.validClientCertificates }} enrolled
          {{ props.settings.validClientCertificates === 1 ? "app keeps" : "apps keep" }} the old address and cannot connect until
          their users connect them again.
        </p>
        <v-switch v-model="notifyAffectedUsers" color="primary" inset hide-details label="Email the affected users" />
      </template>
    </ConfirmDialog>
  </v-card>
</template>
