<script setup lang="ts">
import { onMounted, watchEffect } from "vue";
import StepUpHost from "@/modules/auth/StepUpHost.vue";
import { instanceName, loadInstanceSettings } from "@/modules/instance-settings/instance-settings.api";
import ToastHost from "@/shared/feedback/ToastHost.vue";
import VersionMismatchBar from "@/shared/version/VersionMismatchBar.vue";

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
    <VersionMismatchBar />
    <router-view />
    <ToastHost />
    <StepUpHost />
  </v-app>
</template>
