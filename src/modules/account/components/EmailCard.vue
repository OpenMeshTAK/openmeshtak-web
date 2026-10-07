<script setup lang="ts">
import { mdiEmailOutline } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useToast } from "@/shared/feedback/toast";
import { isRealEmail } from "@/modules/auth/account-email";
import { authClient } from "@/modules/auth/auth-client";

/**
 * The account's email address. Email is optional; a new or changed address is only used after
 * the link sent to it was opened, and the previous verified address is told about the change.
 */
const toast = useToast();
const email = ref<string | null>(null);
const verified = ref(false);
const newEmail = ref("");
const editing = ref(false);
const busy = ref(false);

const hasRealEmail = computed(() => isRealEmail(email.value));

async function load(): Promise<void> {
  const session = await authClient.getSession();
  email.value = session.data?.user.email ?? null;
  verified.value = session.data?.user.emailVerified === true;
}

function callbackUrl(): string {
  return new URL("/account", window.location.origin).href;
}

async function sendVerification(): Promise<void> {
  if (email.value === null) {
    return;
  }
  busy.value = true;
  const result = await authClient.sendVerificationEmail({ email: email.value, callbackURL: callbackUrl() });
  busy.value = false;
  if (result.error) {
    toast.error("The email could not be sent. Email delivery may not be set up yet.");
  } else {
    toast.success(`A confirmation link was sent to ${email.value}.`);
  }
}

async function changeEmail(): Promise<void> {
  busy.value = true;
  const result = await authClient.changeEmail({ newEmail: newEmail.value.trim(), callbackURL: callbackUrl() });
  busy.value = false;
  if (result.error) {
    toast.error("The address could not be changed. Email delivery may not be set up yet.");
    return;
  }
  toast.success(`Open the link sent to ${newEmail.value.trim()} to finish the change.`);
  editing.value = false;
  newEmail.value = "";
}

onMounted(load);
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center ga-2 mb-1">
      <v-icon :icon="mdiEmailOutline" size="small" />
      <div class="text-title-medium font-weight-medium flex-grow-1">Email</div>
      <template v-if="hasRealEmail">
        <v-chip v-if="verified" size="small" color="success" variant="tonal">Confirmed</v-chip>
        <v-chip v-else size="small" color="warning" variant="tonal">Not confirmed</v-chip>
      </template>
    </div>
    <p class="text-body-medium text-medium-emphasis mt-0 mb-3">
      Used for password resets and security notices. Only confirmed addresses receive emails.
    </p>
    <div v-if="hasRealEmail" class="text-body-large mb-3">{{ email }}</div>
    <p v-else class="text-body-medium mt-0 mb-3">No email address yet.</p>

    <form v-if="editing" class="d-flex align-start ga-2" @submit.prevent="changeEmail">
      <v-text-field v-model="newEmail" label="New email address" type="email" autocomplete="email" density="compact" autofocus />
      <v-btn variant="text" @click="editing = false">Cancel</v-btn>
      <v-btn type="submit" color="primary" :loading="busy" :disabled="newEmail.trim() === ''">Send link</v-btn>
    </form>
    <div v-else class="d-flex ga-2">
      <v-btn variant="tonal" @click="editing = true">{{ hasRealEmail ? "Change address" : "Add address" }}</v-btn>
      <v-btn v-if="hasRealEmail && !verified" variant="text" :loading="busy" @click="sendVerification">Send confirmation link</v-btn>
    </div>
  </v-card>
</template>
