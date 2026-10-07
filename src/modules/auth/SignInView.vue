<script setup lang="ts">
import { mdiKeyVariant } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchRegistrationMode } from "@/modules/registration/registration.api";
import { safeRedirectPath } from "@/shared/security/safe-redirect";
import { authClient } from "./auth-client";
import { useSession } from "./session";

const route = useRoute();
const router = useRouter();
const session = useSession();

/** Username or email address; both sign in to the same account. */
const login = ref("");
const password = ref("");
const submitting = ref(false);
const error = ref<string | null>(null);
/** Only open registration has a public entry; invite-only sign-up starts from the invite link. */
const registrationOpen = ref(false);

onMounted(async () => {
  try {
    registrationOpen.value = (await fetchRegistrationMode()) === "open";
  } catch {
    registrationOpen.value = false;
  }
});

async function completeSignIn(): Promise<void> {
  password.value = "";
  await session.refresh();
  await router.replace(safeRedirectPath(route.query.redirect));
}

async function signInWithPasskey(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const result = await authClient.signIn.passkey();
    if (result.error) {
      error.value = "Signing in with a passkey did not work. Try again or use your password.";
      return;
    }
    await completeSignIn();
  } catch {
    error.value = "OpenMeshTak is not reachable. Check your connection and try again.";
  } finally {
    submitting.value = false;
  }
}

async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const name = login.value.trim();
    const result = name.includes("@")
      ? await authClient.signIn.email({ email: name, password: password.value })
      : await authClient.signIn.username({ username: name.toLowerCase(), password: password.value });
    if (result.error) {
      // Generic on purpose: never reveal whether the account exists.
      error.value =
        result.error.status === 429
          ? "Too many attempts. Wait a moment and try again."
          : "Username, email or password is not correct.";
      return;
    }
    await completeSignIn();
  } catch {
    error.value = "OpenMeshTak is not reachable. Check your connection and try again.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-headline-small mt-0 mb-6">Sign in</h1>
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <v-form @submit.prevent="submit">
      <v-text-field v-model="login" label="Username or email" autocomplete="username" autocapitalize="none" spellcheck="false" required />
      <v-text-field
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
      />
      <v-btn type="submit" color="primary" size="large" block class="mt-4" :loading="submitting">
        Sign in
      </v-btn>
    </v-form>
    <div class="d-flex justify-end mt-1">
      <v-btn to="/forgot-password" variant="text" size="small">Forgot password?</v-btn>
    </div>
    <v-btn variant="tonal" size="large" block class="mt-3" :prepend-icon="mdiKeyVariant" :disabled="submitting" @click="signInWithPasskey">
      Sign in with a passkey
    </v-btn>
    <v-btn v-if="registrationOpen" variant="text" block class="mt-2" :to="{ name: 'register' }">Create account</v-btn>
    <p class="text-body-medium text-medium-emphasis mt-6 mb-0">
      Participants receive a personal access link from their organizers instead of a password.
    </p>
  </v-card>
</template>
