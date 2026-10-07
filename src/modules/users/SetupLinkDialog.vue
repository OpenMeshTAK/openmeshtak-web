<script setup lang="ts">
import { ref, watch } from "vue";
import OneTimeLinkReveal from "@/shared/components/OneTimeLinkReveal.vue";
import { describeError } from "@/shared/errors/api-problem";
import { createSetupLink, type SetupLinkDto, type UserDto } from "./users.api";

/** A new setup link for a user who has not set a password yet, e.g. after the first expired. */
const props = defineProps<{ user: UserDto }>();
const open = defineModel<boolean>({ required: true });

const link = ref<SetupLinkDto | null>(null);
const creating = ref(false);
const error = ref<string | null>(null);

async function create(): Promise<void> {
  creating.value = true;
  error.value = null;
  try {
    link.value = await createSetupLink(props.user.id);
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    creating.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    link.value = null;
    error.value = null;
  }
});
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">Setup link for {{ user.displayName }}</v-card-title>
      <v-card-text>
        <OneTimeLinkReveal v-if="link" :url="link.url" :expires-at="link.expiresAt" label="Setup link">
          Anyone with this link can set up the account of {{ user.displayName }}. Share it privately.
          It is shown only now and cannot be displayed again.
        </OneTimeLinkReveal>
        <template v-else>
          <p class="text-body-2 mb-4">
            {{ user.displayName }} opens this link once to choose a password. It is valid for seven
            days. Creating a new link invalidates earlier ones.
          </p>
          <v-alert v-if="error" type="error" class="mb-2">{{ error }}</v-alert>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ link ? "Done" : "Cancel" }}</v-btn>
        <v-btn v-if="!link" color="primary" variant="flat" :loading="creating" @click="create">Create setup link</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
