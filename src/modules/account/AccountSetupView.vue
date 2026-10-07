<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiEye, mdiEyeOff } from "@mdi/js";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { authClient } from "@/modules/auth/auth-client";
import { useSession } from "@/modules/auth/session";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import { completeAccountSetup } from "./account-security";

/**
 * First screen after an access link: the account has a session but no password yet. The person
 * picks the username, sets the password they will sign in and log in to TAK apps with, and may
 * add an email address for password resets. Accounts that are already set up never come here.
 */
const MINIMUM_LENGTH = 12;

const router = useRouter();
const session = useSession();
const toast = useToast();

const username = ref(session.state.principal?.username ?? "");
const email = ref("");
const password = ref("");
const repeated = ref("");
const reveal = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const confirmSignOut = ref(false);
const signingOut = ref(false);

const passwordProblem = computed(() => {
  if (password.value !== "" && password.value.length < MINIMUM_LENGTH) {
    return `Use at least ${String(MINIMUM_LENGTH)} characters.`;
  }
  if (repeated.value !== "" && repeated.value !== password.value) {
    return "The passwords do not match.";
  }
  return null;
});
const ready = computed(
  () =>
    usernameRule(normalizeUsernameInput(username.value)) === true &&
    password.value !== "" &&
    repeated.value === password.value &&
    passwordProblem.value === null,
);

/** The address is only used after its confirmation link was opened; a failure here is not fatal. */
async function addEmail(): Promise<void> {
  const address = email.value.trim();
  if (address === "") {
    return;
  }
  const result = await authClient.changeEmail({ newEmail: address, callbackURL: new URL("/account", window.location.origin).href });
  if (result.error) {
    toast.warning("Your account is ready, but the email address could not be saved. Add it later on your account page.");
  } else {
    toast.info(`Open the link sent to ${address} to confirm your email address.`);
  }
}

/**
 * Leaving is allowed, but the link that opened this session was single-use: without a password
 * the person needs a new link to come back, so the dialog says so before signing out.
 */
async function signOut(): Promise<void> {
  signingOut.value = true;
  try {
    await session.signOut();
    await router.replace({ name: "sign-in" });
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    signingOut.value = false;
    confirmSignOut.value = false;
  }
}

async function submit(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    await completeAccountSetup(normalizeUsernameInput(username.value), password.value);
    password.value = "";
    repeated.value = "";
    await addEmail();
    await session.refresh();
    toast.success("Your account is ready. Sign in and log in to TAK apps with your username and password.");
    await router.replace({ name: "home" });
  } catch (caught: unknown) {
    error.value = isApiProblem(caught, "RECENT_AUTHENTICATION_REQUIRED")
      ? "This access link session is too old to finish setup. Ask your organizers for a new access link."
      : isApiProblem(caught, "USERNAME_TAKEN")
        ? "That username is already in use. Choose another one."
        : describeError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-headline-small mt-0 mb-2">Set up your account</h1>
    <p class="text-body-medium text-medium-emphasis mt-0 mb-6">
      Hello {{ session.state.principal?.name }}. Choose how you sign in from now on. The access link works only once.
    </p>

    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <v-form @submit.prevent="submit">
      <v-text-field
        v-model="username"
        label="Username"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        :rules="[(value: string) => usernameRule(normalizeUsernameInput(value))]"
        class="mb-2"
      >
        <template #append-inner>
          <InfoHint label="About username" :text="USERNAME_HINT" />
        </template>
      </v-text-field>
      <v-text-field
        v-model="password"
        :type="reveal ? 'text' : 'password'"
        label="Password (at least 12 characters)"
        autocomplete="new-password"
        :append-inner-icon="reveal ? mdiEyeOff : mdiEye"
        class="mb-2"
        @click:append-inner="reveal = !reveal"
      />
      <v-text-field
        v-model="repeated"
        :type="reveal ? 'text' : 'password'"
        label="Repeat password"
        autocomplete="new-password"
        :error-messages="passwordProblem ?? []"
      />
      <v-text-field
        v-model="email"
        label="Email (optional)"
        type="email"
        autocomplete="email"
      >
        <template #append-inner>
          <InfoHint label="About email" text="Only for password resets and security notices. You confirm it with a link." />
        </template>
      </v-text-field>
      <v-btn type="submit" color="primary" size="large" block class="mt-6" :loading="saving" :disabled="!ready">
        Finish setup
      </v-btn>
      <v-btn variant="text" block class="mt-2" :disabled="saving" @click="confirmSignOut = true">Cancel and sign out</v-btn>
    </v-form>

    <ConfirmDialog v-model="confirmSignOut" title="Sign out without finishing?" confirm-label="Sign out" :loading="signingOut" @confirm="signOut">
      Your account has no password yet, and the link you used works only once. To set up your
      account later, ask for a new link.
    </ConfirmDialog>
  </v-card>
</template>
