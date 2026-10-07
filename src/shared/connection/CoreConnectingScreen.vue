<script setup lang="ts">
import AppLogo from "@/shared/components/AppLogo.vue";
import { coreConnection } from "./core-connection";

/** Shown instead of an empty page while Core does not answer yet, e.g. right after an update. */
</script>

<template>
  <div class="connecting" role="status" aria-live="polite">
    <AppLogo :size="56" class="mb-8" />
    <v-progress-circular indeterminate color="primary" size="36" width="3" class="mb-6" />
    <div class="text-title-large mb-2">Connecting to the server…</div>
    <div class="text-body-medium text-medium-emphasis text-center">
      OpenMeshTak is starting or briefly unreachable. This page continues by itself as soon as it answers.
      <template v-if="coreConnection.attempts > 3"><br>Still trying ({{ coreConnection.attempts }} attempts).</template>
    </div>
  </div>
</template>

<style scoped>
.connecting {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(var(--v-theme-background));
}
</style>
