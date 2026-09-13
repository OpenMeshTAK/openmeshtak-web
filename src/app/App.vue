<script setup lang="ts">
import ToastHost from "@/shared/feedback/ToastHost.vue";
</script>

<template>
  <v-app>
    <router-view />
    <ToastHost />
  </v-app>
</template>
