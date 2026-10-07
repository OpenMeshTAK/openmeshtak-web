<script setup lang="ts">
import { mdiKeyVariant } from "@mdi/js";
import { ref, watch } from "vue";
import { authClient } from "./auth-client";
import { useSession } from "./session";

/**
 * Step-up for sensitive actions such as creating API keys or changing TAK certificates.
 * Signing in again yields a fresh session; the caller then retries its action. Routine work
 * never asks for this. `StepUpHost` opens it for every API call that needs it.
 */
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirmed: [] }>();
const session = useSession();

/** Username or email address; both sign in to the same account. */
const login = ref("");
const password = ref("");
const submitting = ref(false);
const error = ref<string | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    login.value = session.state.principal?.username ?? login.value;
  } else {
    password.value = "";
    error.value = null;
  }
});

async function finish(): Promise<void> {
  await session.refresh();
  // Confirm before closing, so listeners never mistake the close for a cancel.
  emit("confirmed");
  open.value = false;
}

async function confirmWithPasskey(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const result = await authClient.signIn.passkey();
    if (result.error) {
      error.value = "Signing in with a passkey did not work. Try again or use your password.";
      return;
    }
    await finish();
  } catch {
    error.value = "OpenMeshTak is not reachable. Check your connection and try again.";
  } finally {
    submitting.value = false;
  }
}

async function confirm(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const name = login.value.trim();
    const result = name.includes("@")
      ? await authClient.signIn.email({ email: name, password: password.value })
      : await authClient.signIn.username({ username: name.toLowerCase(), password: password.value });
    if (result.error) {
      error.value =
        result.error.status === 429
          ? "Too many attempts. Wait a moment and try again."
          : "Username, email or password is not correct.";
      return;
    }
    await finish();
  } catch {
    error.value = "OpenMeshTak is not reachable. Check your connection and try again.";
  } finally {
    password.value = "";
    submitting.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card class="pa-2">
      <v-card-title>Sign in again</v-card-title>
      <v-card-text>
        <p class="text-body-medium mt-0 mb-4">
          This is a sensitive action. Confirm it is you to continue; it runs right after you sign in.
        </p>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <v-form @submit.prevent="confirm">
          <v-text-field v-model="login" label="Username or email" autocomplete="username" autocapitalize="none" spellcheck="false" />
          <v-text-field v-model="password" label="Password" type="password" autocomplete="current-password" autofocus />
          <v-btn type="submit" color="primary" block :loading="submitting">Continue</v-btn>
        </v-form>
        <v-btn variant="tonal" block class="mt-3" :prepend-icon="mdiKeyVariant" :disabled="submitting" @click="confirmWithPasskey">
          Use a passkey
        </v-btn>
        <v-btn variant="text" block class="mt-2" :disabled="submitting" @click="open = false">Cancel</v-btn>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
