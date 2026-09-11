<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, unwrap } from "@/shared/api/client";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";

const router = useRouter();
const session = useSession();
const state = ref<"exchanging" | "invalid" | "failed">("exchanging");

/**
 * The claim token arrives in the URL fragment, which browsers never send to a server. Read it and
 * immediately replace the history entry so the token cannot be revisited, synced or shared, then
 * send it once in a request body.
 */
function takeTokenFromFragment(): string {
  const token = decodeURIComponent(window.location.hash.slice(1));
  window.history.replaceState(null, "", window.location.pathname);
  return token;
}

// Kept only in this component's memory so a network failure can be retried without the URL.
let token = "";

async function exchange(): Promise<void> {
  state.value = "exchanging";
  try {
    await unwrap(api.POST("/auth/claims/exchange", { body: { token } }));
    token = "";
    await session.refresh();
    await router.replace({ name: "home" });
  } catch (error: unknown) {
    state.value = isApiProblem(error) && error.status === 401 ? "invalid" : "failed";
  }
}

onMounted(async () => {
  token = takeTokenFromFragment();
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
      <p class="text-body-1">Opening your OpenMeshTak access…</p>
    </template>
    <template v-else-if="state === 'invalid'">
      <h1 class="text-h6 mb-2">This link cannot be used</h1>
      <p class="text-body-2 text-medium-emphasis">
        Access links work only once and expire after 24 hours. Ask your organizers for a new one.
      </p>
    </template>
    <template v-else>
      <h1 class="text-h6 mb-2">OpenMeshTak is not reachable</h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Check your connection and try again.
      </p>
      <v-btn color="primary" @click="exchange">Try again</v-btn>
    </template>
  </v-card>
</template>
