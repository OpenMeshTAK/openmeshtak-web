<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { authClient } from "./auth-client";

/**
 * Better Auth redirects reset links here with `?token=` or, for used or expired links,
 * `?error=INVALID_TOKEN`. The token is kept only in memory and sent once.
 */
const MINIMUM_LENGTH = 12;

const route = useRoute();
const token = typeof route.query.token === "string" ? route.query.token : null;
const invalidLink = token === null || route.query.error !== undefined;

const password = ref("");
const repeated = ref("");
const submitting = ref(false);
const done = ref(false);
const error = ref<string | null>(null);

const problem = computed(() => {
  if (password.value !== "" && password.value.length < MINIMUM_LENGTH) {
    return `Use at least ${String(MINIMUM_LENGTH)} characters.`;
  }
  return repeated.value !== "" && repeated.value !== password.value ? "The passwords do not match." : null;
});

async function submit(): Promise<void> {
  if (token === null) {
    return;
  }
  submitting.value = true;
  error.value = null;
  const result = await authClient.resetPassword({ newPassword: password.value, token });
  submitting.value = false;
  if (result.error) {
    error.value = "This reset link is no longer valid. Ask for a new one.";
  } else {
    done.value = true;
  }
}
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-headline-small mt-0 mb-4">Choose a new password</h1>
    <template v-if="done">
      <p class="text-body-large mt-0 mb-4">Your password was changed and all sessions were signed out.</p>
      <v-btn to="/sign-in" color="primary" block>Sign in</v-btn>
    </template>
    <template v-else-if="invalidLink">
      <p class="text-body-large mt-0 mb-4">This reset link is invalid, already used or expired.</p>
      <v-btn to="/forgot-password" color="primary" block>Ask for a new link</v-btn>
    </template>
    <v-form v-else @submit.prevent="submit">
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-text-field v-model="password" label="New password" type="password" autocomplete="new-password" required />
      <v-text-field v-model="repeated" label="Repeat new password" type="password" autocomplete="new-password" :error-messages="problem ?? []" required />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        class="mt-2"
        :loading="submitting"
        :disabled="password === '' || repeated !== password || problem !== null"
      >
        Save password
      </v-btn>
    </v-form>
  </v-card>
</template>
