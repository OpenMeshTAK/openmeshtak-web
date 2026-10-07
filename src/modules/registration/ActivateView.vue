<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import { exchangeSetupLink } from "./registration.api";

/**
 * Landing page of a setup link for an administrator-created user. Like access links, the token
 * arrives in the URL fragment, leaves the browser history at once and is sent once in a request
 * body. The session then continues in account setup, where the person chooses a password.
 */
const router = useRouter();
const session = useSession();
const state = ref<"exchanging" | "invalid" | "failed">("exchanging");

let token = "";

async function exchange(): Promise<void> {
  state.value = "exchanging";
  try {
    await exchangeSetupLink(token);
    token = "";
    await session.refresh();
    await router.replace({ name: "account-setup" });
  } catch (error: unknown) {
    state.value = isApiProblem(error) && error.status === 401 ? "invalid" : "failed";
  }
}

onMounted(async () => {
  token = decodeURIComponent(window.location.hash.slice(1));
  window.history.replaceState(null, "", window.location.pathname);
  if (token === "") {
    state.value = "invalid";
    return;
  }
  await exchange();
});

onBeforeUnmount(() => {
  token = "";
});
</script>

<template>
  <v-card class="pa-6 text-center">
    <template v-if="state === 'exchanging'">
      <v-progress-circular indeterminate color="primary" class="mb-4" />
      <p class="text-body-large ma-0">Opening your account setup…</p>
    </template>
    <template v-else-if="state === 'invalid'">
      <h1 class="text-title-large font-weight-medium mt-0 mb-2">This link cannot be used</h1>
      <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
        Setup links work only once and expire after seven days. If you already chose a password,
        sign in with it. Otherwise ask an administrator for a new link.
      </p>
      <v-btn color="primary" :to="{ name: 'sign-in' }">Sign in</v-btn>
    </template>
    <template v-else>
      <h1 class="text-title-large font-weight-medium mt-0 mb-2">OpenMeshTak is not reachable</h1>
      <p class="text-body-medium text-medium-emphasis mt-0 mb-4">Check your connection and try again.</p>
      <v-btn color="primary" @click="exchange">Try again</v-btn>
    </template>
  </v-card>
</template>
