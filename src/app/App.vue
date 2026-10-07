<script setup lang="ts">
import { onMounted, watchEffect } from "vue";
import StepUpHost from "@/modules/auth/StepUpHost.vue";
import { useLiveSession } from "@/modules/auth/useLiveSession";
import { instanceName, loadInstanceSettings } from "@/modules/instance-settings/instance-settings.api";
import { coreConnection } from "@/shared/connection/core-connection";
import CoreConnectingScreen from "@/shared/connection/CoreConnectingScreen.vue";
import ToastHost from "@/shared/feedback/ToastHost.vue";
import VersionMismatchBar from "@/shared/version/VersionMismatchBar.vue";

const { connectionLost } = useLiveSession();

watchEffect(() => {
  document.title = instanceName.value;
});

// The default name stays when Core is unreachable; pages report that themselves.
onMounted(() => {
  loadInstanceSettings().catch(() => undefined);
});
</script>

<template>
  <v-app>
    <CoreConnectingScreen v-if="coreConnection.waiting" />
    <VersionMismatchBar />
    <v-system-bar v-if="connectionLost" color="warning" height="auto" class="py-1 px-4 text-body-medium">
      The connection to the server was lost. Reconnecting…
    </v-system-bar>
    <router-view />
    <ToastHost />
    <StepUpHost />
  </v-app>
</template>
