<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { getEmailSettings, saveEmailSettings, sendTestEmail, type EmailSettingsChanges, type EmailSettingsDto } from "./email-settings.api";

/**
 * SMTP delivery for password resets, address confirmations and security notices. The password is
 * write-only: the form only sends it when the administrator typed a new one.
 */
const toast = useToast();
const page = useAsyncData(getEmailSettings, null as EmailSettingsDto | null);
const form = ref<EmailSettingsChanges>({
  enabled: false,
  host: null,
  port: 587,
  security: "starttls",
  username: null,
  fromAddress: null,
  fromName: "OpenMeshTak",
});
const newPassword = ref("");
const confirmRemovePassword = ref(false);
const saving = ref(false);
const errors = ref<Record<string, string>>({});
const testAddress = ref("");
const testing = ref(false);

const securityOptions = [
  { value: "starttls", title: "STARTTLS (usually port 587)" },
  { value: "tls", title: "TLS (usually port 465)" },
  { value: "none", title: "None (local relay only)" },
];

function show(settings: EmailSettingsDto): void {
  page.data.value = settings;
  form.value = {
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    security: settings.security,
    username: settings.username,
    fromAddress: settings.fromAddress,
    fromName: settings.fromName,
  };
  newPassword.value = "";
}

async function save(): Promise<void> {
  if (page.data.value === null) {
    return;
  }
  saving.value = true;
  errors.value = {};
  const password = newPassword.value === "" ? {} : { password: newPassword.value };
  try {
    show(await saveEmailSettings(page.data.value.version, { ...form.value, fromAddress: form.value.fromAddress?.trim() || null, ...password }));
    toast.success("Email settings saved.");
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

/** Removes the stored SMTP password right away, keeping the other stored settings unchanged. */
async function removePassword(): Promise<void> {
  confirmRemovePassword.value = false;
  const stored = page.data.value;
  if (stored === null) {
    return;
  }
  try {
    const saved = await saveEmailSettings(stored.version, {
      enabled: stored.enabled,
      host: stored.host,
      port: stored.port,
      security: stored.security,
      username: stored.username,
      fromAddress: stored.fromAddress,
      fromName: stored.fromName,
      password: null,
    });
    // Keep unsaved edits in the form; only the password state and version come from the server.
    page.data.value = saved;
    toast.success("Stored SMTP password removed.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function test(): Promise<void> {
  testing.value = true;
  try {
    await sendTestEmail(testAddress.value.trim());
    toast.success(`Test email sent to ${testAddress.value.trim()}.`);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    testing.value = false;
  }
}

onMounted(async () => {
  await page.load();
  if (page.data.value !== null) {
    show(page.data.value);
  }
});
</script>

<template>
  <div>
    <ViewHeader title="Email" subtitle="SMTP delivery for password resets, address confirmations and security notices." />
    <v-skeleton-loader v-if="page.state.value === 'loading'" type="article" />
    <ErrorState v-else-if="page.state.value === 'error' || page.data.value === null" :message="page.error.value" @retry="page.load" />
    <v-row v-else>
      <v-col cols="12" lg="7">
        <v-card class="pa-5">
          <div class="d-flex align-center mb-4">
            <div class="text-subtitle-1 font-weight-medium flex-grow-1">SMTP server</div>
            <v-switch v-model="form.enabled" color="primary" inset hide-details label="Enabled" />
          </div>
          <v-row dense>
            <v-col cols="12" sm="8"><v-text-field v-model="form.host" label="Host" :error-messages="messagesFor(errors, 'host')" /></v-col>
            <v-col cols="12" sm="4"><v-text-field v-model.number="form.port" type="number" label="Port" /></v-col>
            <v-col cols="12"><v-select v-model="form.security" :items="securityOptions" label="Encryption" /></v-col>
            <v-col cols="12" sm="6"><v-text-field v-model="form.username" label="Username (optional)" autocomplete="off" /></v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                :label="page.data.value.passwordSet ? 'New password (leave empty to keep)' : 'Password (optional)'"
                :append-inner-icon="page.data.value.passwordSet && newPassword === '' ? mdiClose : undefined"
                :hint="page.data.value.passwordSet ? 'A password is stored.' : ''"
                persistent-hint
                @click:append-inner="confirmRemovePassword = true"
              />
            </v-col>
            <v-col cols="12" sm="6"><v-text-field v-model="form.fromAddress" label="Sender address" type="email" :error-messages="messagesFor(errors, 'fromAddress')" /></v-col>
            <v-col cols="12" sm="6"><v-text-field v-model="form.fromName" label="Sender name" /></v-col>
          </v-row>
          <div class="d-flex justify-end">
            <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" lg="5">
        <v-card class="pa-5">
          <div class="text-subtitle-1 font-weight-medium mb-1">Test</div>
          <p class="text-body-2 text-medium-emphasis mb-3">Save first, then send a test email with the stored settings.</p>
          <v-text-field v-model="testAddress" label="Recipient" type="email" density="compact" />
          <v-btn variant="tonal" block :loading="testing" :disabled="testAddress.trim() === '' || !page.data.value.enabled" @click="test">Send test email</v-btn>
        </v-card>
      </v-col>
    </v-row>
    <ConfirmDialog
      :model-value="confirmRemovePassword"
      title="Remove the stored SMTP password?"
      confirm-label="Remove"
      confirm-color="error"
      @update:model-value="confirmRemovePassword = false"
      @confirm="removePassword"
    >
      The SMTP server is then used without a password. Emails fail if the server requires one.
    </ConfirmDialog>
  </div>
</template>
