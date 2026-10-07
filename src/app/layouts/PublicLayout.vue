<script setup lang="ts">
import { instanceName } from "@/modules/instance-settings/instance-settings.api";
import AppLogo from "@/shared/components/AppLogo.vue";
</script>

<template>
  <v-main class="d-flex align-center">
    <v-container class="py-8" style="max-width: 480px">
      <div class="d-flex flex-column align-center ga-2 mb-6">
        <AppLogo :size="44" />
        <div class="text-title-large font-weight-bold text-center">{{ instanceName }}</div>
      </div>
      <router-view />
    </v-container>
  </v-main>
</template>
