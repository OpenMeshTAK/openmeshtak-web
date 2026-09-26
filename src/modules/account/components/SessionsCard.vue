<script setup lang="ts">
import { mdiDevices } from "@mdi/js";
import { onMounted } from "vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import { endOtherSessions, endSession, listSessions, type SessionSummary } from "../account-security";

/** Where the user is signed in, with sign-out for single devices or all other devices. */
const toast = useToast();
const sessions = useAsyncData(listSessions, [] as SessionSummary[]);
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
  await sessions.load();
}

async function endOthers(): Promise<void> {
  try {
    await endOtherSessions();
    toast.success("All other sessions ended.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
  await sessions.load();
}

defineExpose({ reload: sessions.load });
onMounted(sessions.load);
</script>

<template>
  <v-card>
    <div class="d-flex align-center pa-5 pb-2">
      <v-icon :icon="mdiDevices" size="small" class="mr-2" />
      <div class="text-subtitle-1 font-weight-medium flex-grow-1">Signed-in devices</div>
      <v-btn variant="text" size="small" :disabled="sessions.data.value.length < 2" @click="endOthers">Sign out other devices</v-btn>
    </div>
    <v-skeleton-loader v-if="sessions.state.value === 'loading'" type="list-item-two-line@2" />
    <v-alert v-else-if="sessions.state.value === 'error'" type="error" class="ma-4">{{ sessions.error.value }}</v-alert>
    <v-list v-else lines="two" class="pt-0">
      <v-list-item
        v-for="session in sessions.data.value"
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
