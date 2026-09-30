<script setup lang="ts">
import { mdiEye, mdiEyeOff, mdiLockReset } from "@mdi/js";
import { computed, ref } from "vue";
import { useSession } from "@/modules/auth/session";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { changePassword, setFirstPassword } from "../account-security";

/** Same minimum as Core's Better Auth configuration; Core checks it again. */
const MINIMUM_LENGTH = 12;

const emit = defineEmits<{ changed: [] }>();
const toast = useToast();
const session = useSession();
/**
 * Accounts opened with an access link have no password yet. They set one without a current
 * password; every account needs it to sign in again and to log in to TAK apps.
 */
const firstPassword = computed(() => session.state.principal?.hasPassword === false);

const currentPassword = ref("");
const newPassword = ref("");
const repeated = ref("");
const reveal = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const problem = computed(() => {
  if (newPassword.value !== "" && newPassword.value.length < MINIMUM_LENGTH) {
    return `Use at least ${String(MINIMUM_LENGTH)} characters.`;
  }
  if (repeated.value !== "" && repeated.value !== newPassword.value) {
    return "The passwords do not match.";
  }
  return null;
});
const ready = computed(() => (firstPassword.value || currentPassword.value !== "") && newPassword.value !== "" && repeated.value === newPassword.value && problem.value === null);

async function submitFirst(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    await setFirstPassword(newPassword.value);
    newPassword.value = "";
    repeated.value = "";
    await session.refresh();
    toast.success("Password set. Use it with your username to sign in and in TAK apps.");
    emit("changed");
  } catch (caught: unknown) {
    error.value = isApiProblem(caught, "RECENT_AUTHENTICATION_REQUIRED")
      ? "Your sign-in is too old to set a password. Open a new access link from your organizers and try again."
      : describeError(caught);
  } finally {
    saving.value = false;
  }
}

async function submit(): Promise<void> {
  if (firstPassword.value) {
    await submitFirst();
    return;
  }
  saving.value = true;
  error.value = null;
  const result = await changePassword(currentPassword.value, newPassword.value);
  saving.value = false;
  if (result.outcome === "changed") {
    currentPassword.value = "";
    newPassword.value = "";
    repeated.value = "";
    toast.success("Password changed. Your other sessions were signed out.");
    emit("changed");
  } else {
    error.value = result.outcome === "wrong-password" ? "The current password is wrong." : result.message;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center ga-2 mb-1">
      <v-icon :icon="mdiLockReset" size="small" />
      <div class="text-subtitle-1 font-weight-medium">{{ firstPassword ? "Set a password" : "Password" }}</div>
    </div>
    <v-alert v-if="firstPassword" type="warning" density="compact" class="mb-4">
      You have no password yet. You need one to sign in again and to log in to TAK apps.
    </v-alert>
    <p v-else class="text-body-2 text-medium-emphasis mb-4">Changing it signs you out on every other device.</p>
    <form @submit.prevent="submit">
      <v-alert v-if="error" type="error" density="compact" class="mb-3">{{ error }}</v-alert>
      <v-text-field
        v-if="!firstPassword"
        v-model="currentPassword"
        :type="reveal ? 'text' : 'password'"
        label="Current password"
        autocomplete="current-password"
      />
      <v-text-field
        v-model="newPassword"
        :type="reveal ? 'text' : 'password'"
        label="New password"
        autocomplete="new-password"
        :append-inner-icon="reveal ? mdiEyeOff : mdiEye"
        @click:append-inner="reveal = !reveal"
      />
      <v-text-field
        v-model="repeated"
        :type="reveal ? 'text' : 'password'"
        label="Repeat new password"
        autocomplete="new-password"
        :error-messages="problem ?? []"
      />
      <div class="d-flex justify-end">
        <v-btn type="submit" color="primary" :loading="saving" :disabled="!ready">
          {{ firstPassword ? "Set password" : "Change password" }}
        </v-btn>
      </div>
    </form>
  </v-card>
</template>
