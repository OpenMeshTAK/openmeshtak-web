<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api, unwrap } from "@/shared/api/client";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useSession } from "@/modules/auth/session";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import { markSetupComplete } from "./setup.api";

const router = useRouter();
const session = useSession();

const form = ref({ token: "", name: "", username: "", email: "", password: "" });
const submitting = ref(false);
const error = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  fields.value = {};
  try {
    // The bootstrap token goes only into this request body, never into the URL or storage.
    await unwrap(api.POST("/setup", { body: { ...form.value, username: normalizeUsernameInput(form.value.username) } }));
    form.value.token = "";
    markSetupComplete();
    await session.refresh();
    await router.replace({ name: "home" });
  } catch (caught: unknown) {
    if (isApiProblem(caught, "ALREADY_CONFIGURED")) {
      markSetupComplete();
      await router.replace({ name: "sign-in" });
      return;
    }
    fields.value = fieldErrors(caught);
    error.value = describeError(caught);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-card class="pa-6">
    <h1 class="text-headline-small mt-0 mb-2">Set up OpenMeshTak</h1>
    <p class="text-body-medium text-medium-emphasis mt-0 mb-6">
      Create the first administrator. Use the one-time setup token printed in the OpenMeshTak Core
      output.
    </p>

    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <v-form @submit.prevent="submit">
      <v-text-field
        v-model="form.token"
        label="Setup token"
        autocomplete="off"
        spellcheck="false"
        :error-messages="messagesFor(fields, 'token')"
        required
      />
      <v-text-field v-model="form.name" label="Your name" autocomplete="name" :error-messages="messagesFor(fields, 'name')" required />
      <v-text-field
        v-model="form.username"
        label="Username"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        :rules="[(value: string) => usernameRule(normalizeUsernameInput(value))]"
        :error-messages="messagesFor(fields, 'username')"
        class="mb-2"
        required
      >
        <template #append-inner>
          <InfoHint label="About username" :text="USERNAME_HINT" />
        </template>
      </v-text-field>
      <v-text-field
        v-model="form.email"
        label="Email"
        type="email"
        autocomplete="email"
        :error-messages="messagesFor(fields, 'email')"
        required
      />
      <v-text-field
        v-model="form.password"
        label="Password (at least 12 characters)"
        type="password"
        autocomplete="new-password"
        :error-messages="messagesFor(fields, 'password')"
        required
      />
      <v-btn type="submit" color="primary" size="large" block class="mt-6" :loading="submitting">
        Create administrator
      </v-btn>
    </v-form>
  </v-card>
</template>
