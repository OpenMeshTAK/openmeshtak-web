<script setup lang="ts">
import { inject, type Component } from "vue";

defineProps<{ title: string; subtitle?: string }>();

/**
 * The app shell provides its account menu so every page shows it in the same row as the page
 * actions. Injecting keeps `shared` independent of product modules.
 */
const profileMenu = inject<Component | null>("view-header-profile", null);
</script>

<template>
  <div class="d-flex align-center ga-3 mb-4">
    <div class="flex-grow-1" style="min-width: 0">
      <h1 class="text-h5 text-truncate page-title">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis text-truncate">{{ subtitle }}</div>
    </div>
    <div class="d-flex align-center flex-wrap justify-end ga-2">
      <slot name="actions" />
    </div>
    <component :is="profileMenu" v-if="profileMenu" />
  </div>
</template>

<style scoped>
/* Tight title/subtitle pairing; the default headline line height leaves a visible gap. */
.page-title {
  line-height: 1.2;
  margin-bottom: 2px;
}
</style>
