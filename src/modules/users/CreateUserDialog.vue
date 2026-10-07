<script setup lang="ts">
import { ref, watch } from "vue";
import OneTimeLinkReveal from "@/shared/components/OneTimeLinkReveal.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import { createUser, type SetupLinkDto, type UserDto } from "./users.api";

/**
 * Creates a user without a password. The person receives a single-use setup link and chooses
 * their own password, so administrators never know it. The link lives only in this dialog's
 * memory and is cleared when it closes.
 */
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ created: [user: UserDto] }>();

const displayName = ref("");
const username = ref("");
const saving = ref(false);
const error = ref<string | null>(null);
const created = ref<{ user: UserDto; setupLink: SetupLinkDto } | null>(null);

function usernameOrEmpty(value: string): true | string {
  return value.trim() === "" || usernameRule(normalizeUsernameInput(value));
}

async function submit(): Promise<void> {
  if (displayName.value.trim() === "" || usernameOrEmpty(username.value) !== true) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const chosen = normalizeUsernameInput(username.value);
    created.value = await createUser(displayName.value.trim(), chosen === "" ? null : chosen);
    emit("created", created.value.user);
  } catch (caught: unknown) {
    error.value = isApiProblem(caught, "USERNAME_TAKEN") ? "That username is already in use. Choose another one." : describeError(caught);
  } finally {
    saving.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    displayName.value = "";
    username.value = "";
    error.value = null;
    created.value = null;
  }
});
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">{{ created ? `Setup link for ${created.user.displayName}` : "Create user" }}</v-card-title>
      <v-card-text>
        <OneTimeLinkReveal v-if="created" :url="created.setupLink.url" :expires-at="created.setupLink.expiresAt" label="Setup link">
          Anyone with this link can set up the account of {{ created.user.displayName }}. Share it
          privately. It is shown only now; you can create a new one from the user's menu.
        </OneTimeLinkReveal>
        <v-form v-else @submit.prevent="submit">
          <p class="text-body-2 text-medium-emphasis mb-4">
            The person gets a setup link, valid for seven days, to choose their own password. Add
            them to user groups or events to give them access.
          </p>
          <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
          <v-text-field v-model="displayName" label="Name" maxlength="100" autofocus />
          <v-text-field
            v-model="username"
            label="Username (optional)"
            autocapitalize="none"
            spellcheck="false"
            :hint="`${USERNAME_HINT} Derived from the name when empty.`"
            persistent-hint
            :rules="[usernameOrEmpty]"
          />
          <button type="submit" hidden />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ created ? "Done" : "Cancel" }}</v-btn>
        <v-btn v-if="!created" color="primary" variant="flat" :loading="saving" :disabled="displayName.trim() === ''" @click="submit">
          Create user
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
