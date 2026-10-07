<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import FormSection from "@/shared/components/layout/FormSection.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { currentAccountEmail } from "@/modules/auth/account-email";
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
const testOpen = ref(false);
const testAddress = ref("");
const testing = ref(false);

const securityOptions = [
  { value: "starttls", title: "STARTTLS (587)" },
  { value: "tls", title: "TLS (465)" },
  { value: "none", title: "None (local relay)" },
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

/** Suggests the administrator's own address, the usual recipient for a test. */
async function openTest(): Promise<void> {
  testOpen.value = true;
  if (testAddress.value === "") {
    testAddress.value = (await currentAccountEmail().catch(() => null)) ?? "";
  }
}

async function test(): Promise<void> {
  const to = testAddress.value.trim();
  if (to === "") {
    return;
  }
  testing.value = true;
  try {
    await sendTestEmail(to);
    toast.success(`Test email sent to ${to}.`);
    testOpen.value = false;
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
  <FormSection title="Email" description="SMTP delivery for password resets, address confirmations and security notices.">
    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="list-item-two-line" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="page.load" /></div>
    <template v-else>
      <div class="px-4 pb-4 pt-3">
        <div class="d-flex align-center ga-4" :class="{ 'mb-3': form.enabled }">
          <div class="flex-grow-1">
            <div class="text-title-small font-weight-medium">Send emails over SMTP</div>
            <div v-if="!form.enabled" class="text-body-medium text-medium-emphasis">Off: password resets and notices are not sent.</div>
          </div>
          <v-switch
            v-model="form.enabled"
            class="flex-grow-0 flex-shrink-0"
            color="primary"
            inset
            hide-details
            aria-label="Send emails over SMTP"
          />
        </div>
        <v-row v-if="form.enabled" dense>
          <v-col cols="12" sm="5"><v-text-field v-model="form.host" label="Host" :error-messages="messagesFor(errors, 'host')" /></v-col>
          <v-col cols="5" sm="2"><v-text-field v-model.number="form.port" type="number" label="Port" /></v-col>
          <v-col cols="7" sm="5"><v-select v-model="form.security" :items="securityOptions" label="Encryption" /></v-col>
          <v-col cols="12" sm="6"><v-text-field v-model="form.username" label="Username (optional)" autocomplete="off" /></v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              :label="page.data.value.passwordSet ? 'New password (leave empty to keep)' : 'Password (optional)'"
              :append-inner-icon="page.data.value.passwordSet && newPassword === '' ? mdiClose : undefined"
              @click:append-inner="confirmRemovePassword = true"
            />
          </v-col>
          <v-col cols="12" sm="6"><v-text-field v-model="form.fromAddress" label="Sender address" type="email" :error-messages="messagesFor(errors, 'fromAddress')" /></v-col>
          <v-col cols="12" sm="6"><v-text-field v-model="form.fromName" label="Sender name" /></v-col>
        </v-row>
        <!-- Disabled and saved as disabled: nothing to save, so the card stays a single line. -->
        <div v-if="form.enabled || page.data.value.enabled" class="d-flex justify-end ga-2 mt-2">
          <!-- Tests the saved settings, so it only appears once SMTP is saved as enabled. -->
          <v-btn v-if="page.data.value.enabled" variant="tonal" @click="openTest">Test</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
        </div>
      </div>
    </template>
    <v-dialog v-model="testOpen" max-width="440">
      <v-card>
        <v-card-title>Send a test email</v-card-title>
        <v-card-text>
          <p class="text-body-medium text-medium-emphasis mt-0 mb-4">Uses the saved settings; unsaved changes in the form are not used.</p>
          <v-text-field v-model="testAddress" label="Recipient" type="email" autofocus hide-details @keydown.enter="test" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="testOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="testing" :disabled="testAddress.trim() === ''" @click="test">Send</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
  </FormSection>
</template>
