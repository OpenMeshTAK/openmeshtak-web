<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiEye, mdiEyeOff } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { authClient } from "@/modules/auth/auth-client";
import { useSession } from "@/modules/auth/session";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import { fetchRegistrationMode, register, type RegistrationMode } from "./registration.api";

/**
 * Self-registration, offered while an administrator allows it. Invite-only registration needs
 * the invite token from the link's URL fragment; it leaves the browser history at once and is
 * sent only in the request body. New accounts have no permissions until an administrator adds
 * them to a user group or an event.
 */
const MINIMUM_LENGTH = 12;

const router = useRouter();
const session = useSession();
const toast = useToast();

const mode = ref<RegistrationMode | null>(null);
const loadFailed = ref(false);
let inviteToken = "";
const hasInvite = ref(false);

const displayName = ref("");
const username = ref("");
const email = ref("");
const password = ref("");
const repeated = ref("");
const reveal = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const available = computed(() => mode.value === "open" || (mode.value === "invite" && hasInvite.value));
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
    displayName.value.trim() !== "" &&
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

function describeFailure(caught: unknown): string {
  if (isApiProblem(caught, "USERNAME_TAKEN")) {
    return "That username is already in use. Choose another one.";
  }
  if (isApiProblem(caught, "INVALID_INVITE")) {
    return "This invite link is no longer usable. Ask an administrator for a new one.";
  }
  if (isApiProblem(caught, "REGISTRATION_CLOSED")) {
    return "This installation does not accept new accounts right now.";
  }
  return describeError(caught);
}

async function submit(): Promise<void> {
  if (!ready.value) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    await register({
      displayName: displayName.value.trim(),
      username: normalizeUsernameInput(username.value),
      password: password.value,
      ...(inviteToken === "" ? {} : { inviteToken }),
    });
    inviteToken = "";
    password.value = "";
    repeated.value = "";
    await addEmail();
    await session.refresh();
    toast.success("Your account is ready. An administrator gives you access to events.");
    await router.replace({ name: "home" });
  } catch (caught: unknown) {
    error.value = describeFailure(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  inviteToken = decodeURIComponent(window.location.hash.slice(1));
  hasInvite.value = inviteToken !== "";
  if (hasInvite.value) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  try {
    mode.value = await fetchRegistrationMode();
  } catch {
    loadFailed.value = true;
  }
});
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-h5 mb-2">Create account</h1>

    <v-progress-linear v-if="mode === null && !loadFailed" indeterminate color="primary" class="my-4" />
    <v-alert v-else-if="loadFailed" type="error" class="mt-4">OpenMeshTak is not reachable. Check your connection and reload.</v-alert>
    <template v-else-if="!available">
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{
          mode === "invite"
            ? "New accounts need an invite link from an administrator."
            : "This installation does not accept new accounts. Ask an administrator for an account."
        }}
      </p>
      <v-btn color="primary" block :to="{ name: 'sign-in' }">Back to sign-in</v-btn>
    </template>

    <template v-else>
      <p class="text-body-2 text-medium-emphasis mb-6">
        Your username and password sign in to OpenMeshTak and log in to TAK apps.
      </p>
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-form @submit.prevent="submit">
        <v-text-field v-model="displayName" label="Name" autocomplete="name" maxlength="100" class="mb-2" />
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
          Create account
        </v-btn>
        <v-btn variant="text" block class="mt-2" :to="{ name: 'sign-in' }">I already have an account</v-btn>
      </v-form>
    </template>
  </v-card>
</template>
