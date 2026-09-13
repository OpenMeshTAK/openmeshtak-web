<script setup lang="ts">
import { mdiKeyVariant } from "@mdi/js";
import { ref, watch } from "vue";
import { authClient } from "./auth-client";
import { useSession } from "./session";

/**
 * Step-up for sensitive actions such as creating API keys. Signing in again yields a fresh
 * session; the caller then retries its action. Routine work never asks for this.
 */
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirmed: [] }>();
const session = useSession();

const email = ref("");
const password = ref("");
const submitting = ref(false);
const error = ref<string | null>(null);

watch(open, (isOpen) => {
  if (!isOpen) {
    password.value = "";
    error.value = null;
  }
});

async function finish(): Promise<void> {
  await session.refresh();
  open.value = false;
  emit("confirmed");
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
  } finally {
    submitting.value = false;
  }
}

async function confirm(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const result = await authClient.signIn.email({ email: email.value, password: password.value });
    if (result.error) {
      error.value = "Email or password is not correct.";
      return;
    }
    await finish();
  } finally {
    password.value = "";
    submitting.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card class="pa-2">
      <v-card-title>Confirm it's you</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-4">This action changes your credentials. Confirm it is you to continue.</p>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <v-form @submit.prevent="confirm">
          <v-text-field v-model="email" label="Email" type="email" autocomplete="username" />
          <v-text-field v-model="password" label="Password" type="password" autocomplete="current-password" />
          <v-btn type="submit" color="primary" block :loading="submitting">Continue</v-btn>
        </v-form>
        <v-btn variant="tonal" block class="mt-3" :prepend-icon="mdiKeyVariant" :disabled="submitting" @click="confirmWithPasskey">
          Use a passkey
        </v-btn>
        <p class="text-caption text-medium-emphasis mt-4 mb-0">
          Signed in with an access link and no password or passkey yet? Ask your organizers for a new link.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
