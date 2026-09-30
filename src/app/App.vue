<script setup lang="ts">
import StepUpHost from "@/modules/auth/StepUpHost.vue";
import ToastHost from "@/shared/feedback/ToastHost.vue";
</script>

<template>
  <v-app>
    <router-view />
    <ToastHost />
    <StepUpHost />
  </v-app>
</template>
