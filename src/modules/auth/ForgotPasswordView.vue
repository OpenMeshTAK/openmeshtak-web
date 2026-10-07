<script setup lang="ts">
import { ref } from "vue";
import { authClient } from "./auth-client";

/**
 * Asks for a reset link. The answer is the same whether or not the address belongs to an account,
 * so the page cannot be used to find out who has one.
 */
const email = ref("");
const submitting = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    await authClient.requestPasswordReset({
      email: email.value.trim(),
      redirectTo: new URL("/reset-password", window.location.origin).href,
    });
    sent.value = true;
  } catch {
    error.value = "OpenMeshTak is not reachable. Check your connection and try again.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-headline-small mt-0 mb-2">Forgot your password?</h1>
    <template v-if="sent">
      <p class="text-body-large mt-0 mb-4">
        If an account with a confirmed email address exists for {{ email }}, a reset link is on its
        way. It works once and for 30 minutes.
      </p>
      <v-btn to="/sign-in" variant="tonal" block>Back to sign-in</v-btn>
    </template>
    <template v-else>
      <p class="text-body-medium text-medium-emphasis mt-0 mb-6">
        Enter the email address of your account. Reset links only go to confirmed addresses.
      </p>
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-form @submit.prevent="submit">
        <v-text-field v-model="email" label="Email" type="email" autocomplete="username" required />
        <v-btn type="submit" color="primary" size="large" block class="mt-2" :loading="submitting" :disabled="email.trim() === ''">
          Send reset link
        </v-btn>
      </v-form>
      <v-btn to="/sign-in" variant="text" block class="mt-3">Back to sign-in</v-btn>
    </template>
  </v-card>
</template>
