<script setup lang="ts">
import StepUpHost from "@/modules/auth/StepUpHost.vue";
import ToastHost from "@/shared/feedback/ToastHost.vue";
import VersionMismatchBar from "@/shared/version/VersionMismatchBar.vue";
</script>

<template>
  <v-app>
    <VersionMismatchBar />
    <router-view />
    <ToastHost />
    <StepUpHost />
  </v-app>
</template>
