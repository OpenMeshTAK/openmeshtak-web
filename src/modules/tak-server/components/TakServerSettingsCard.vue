<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

async function save(): Promise<void> {
  saving.value = true;
  errors.value = {};
  try {
    const saved = await saveTakServerSettings(props.settings.version, {
      ...form.value,
      hostName: form.value.hostName?.trim() || null,
    });
    toast.success(saved.enabled ? "TAK server settings saved. The listeners restart now." : "TAK server settings saved.");
    emit("saved", saved);
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-4">
      <div class="flex-grow-1">
        <div class="text-subtitle-1 font-weight-medium">Server</div>
        <div class="text-body-2 text-medium-emphasis">
          Public ports that devices connect to directly, not through the Web proxy. QR codes and profiles use them.
        </div>
      </div>
      <v-switch v-model="form.enabled" color="primary" inset hide-details label="Enabled" />
    </div>
    <v-row dense>
      <v-col cols="12">
        <v-text-field
          v-model="form.hostName"
          label="Public host name"
          hint="Name or IPv4 address that phones reach, e.g. tak.example.org"
          persistent-hint
          :error-messages="messagesFor(errors, 'hostName')"
        />
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
      <v-col v-if="quickConnectChanged || martiChanged" cols="12">
        <v-alert v-if="quickConnectChanged" type="warning" density="compact" class="mb-2">
          ATAK Quick Connect expects enrollment on 8446 and streaming on 8089. Other ports mean participants must enter them
          by hand. Prefer a separate public address over changing them.
        </v-alert>
        <v-alert v-if="martiChanged" type="info" density="compact">
          ATAK learns a different Data Package port from its enrollment profile. The setting applies to every server in the
          app, and iTAK is not verified yet. Publish the same port in Docker.
        </v-alert>
      </v-col>
      <v-col cols="12" sm="6">
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
      <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
    </div>
  </v-card>
</template>
