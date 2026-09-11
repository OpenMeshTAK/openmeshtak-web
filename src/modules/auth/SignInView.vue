<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { safeRedirectPath } from "@/shared/security/safe-redirect";
import { authClient } from "./auth-client";
import { useSession } from "./session";

const route = useRoute();
const router = useRouter();
const session = useSession();

const email = ref("");
const password = ref("");
const submitting = ref(false);
const error = ref<string | null>(null);

async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const result = await authClient.signIn.email({ email: email.value, password: password.value });
    if (result.error) {
      // Generic on purpose: never reveal whether the account exists.
      error.value =
        result.error.status === 429
          ? "Too many attempts. Wait a moment and try again."
          : "Email or password is not correct.";
      return;
    }
    password.value = "";
    await session.refresh();
    await router.replace(safeRedirectPath(route.query.redirect));
  } catch {
    error.value = "OpenMeshTak is not reachable. Check your connection and try again.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-h5 mb-6">Sign in</h1>
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <v-form @submit.prevent="submit">
      <v-text-field v-model="email" label="Email" type="email" autocomplete="username" required />
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
    <p class="text-body-2 text-medium-emphasis mt-6">
      Participants receive a personal access link from their organizers instead of a password.
    </p>
  </v-card>
</template>
