<script setup lang="ts">
import { mdiDevices } from "@mdi/js";
import { onMounted, ref } from "vue";
import { requestStepUp } from "@/modules/auth/step-up";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { endOtherSessions, endSession, FreshSignInRequiredError, listSessions, type SessionSummary } from "../account-security";

/** Where the user is signed in, with sign-out for single devices or all other devices. */
const toast = useToast();
const sessions = ref<SessionSummary[]>([]);
const state = ref<"loading" | "ready" | "sign-in-required" | "error">("loading");
const error = ref("");

/**
 * Better Auth shows the session list only shortly after a sign-in. An older session gets a
 * button to sign in again instead of an error; the prompt never opens by itself.
 */
async function load(): Promise<void> {
  state.value = "loading";
  try {
    sessions.value = await listSessions();
    state.value = "ready";
  } catch (caught: unknown) {
    state.value = caught instanceof FreshSignInRequiredError ? "sign-in-required" : "error";
    error.value = caught instanceof Error && !(caught instanceof TypeError) ? caught.message : describeError(caught);
  }
}

async function signInAgain(): Promise<void> {
  if (await requestStepUp()) {
    await load();
  }
}
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** A short, readable device hint from the user agent; never shown in full. */
function deviceOf(session: SessionSummary): string {
  const agent = session.userAgent ?? "";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Windows/.test(agent) ? "Windows" : /Mac OS X/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return system === "" ? browser : `${browser} on ${system}`;
}

async function end(session: SessionSummary): Promise<void> {
  try {
    await endSession(session.token);
    toast.success("Session ended.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
  await load();
}

async function endOthers(): Promise<void> {
  try {
    await endOtherSessions();
    toast.success("All other sessions ended.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
  await load();
}

defineExpose({ reload: load });
onMounted(load);
</script>

<template>
  <v-card>
    <div class="d-flex align-center pa-5 pb-2">
      <v-icon :icon="mdiDevices" size="small" class="mr-2" />
      <div class="text-title-medium font-weight-medium flex-grow-1">Signed-in devices</div>
      <v-btn variant="text" size="small" :disabled="sessions.length < 2" @click="endOthers">Sign out other devices</v-btn>
    </div>
    <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line@2" />
    <v-alert v-else-if="state === 'sign-in-required'" type="info" density="compact" class="ma-4">
      <div class="d-flex align-center flex-wrap ga-2">
        <span class="flex-grow-1">{{ error }}</span>
        <v-btn size="small" variant="tonal" @click="signInAgain">Sign in again</v-btn>
      </div>
    </v-alert>
    <v-alert v-else-if="state === 'error'" type="error" class="ma-4">{{ error }}</v-alert>
    <v-list v-else lines="two" class="pt-0">
      <v-list-item
        v-for="session in sessions"
        :key="session.token"
        :title="deviceOf(session)"
        :subtitle="`Signed in ${dateFormat.format(new Date(session.createdAt))}`"
      >
        <template #append>
          <v-chip v-if="session.current" size="small" color="primary" variant="tonal">This device</v-chip>
          <v-btn v-else variant="text" size="small" color="error" @click="end(session)">Sign out</v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>
