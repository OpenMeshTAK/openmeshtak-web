<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="page-header d-flex flex-wrap align-center ga-3 mb-6">
    <div class="flex-grow-1" style="min-width: 0">
      <h1 class="text-h5 text-truncate page-title">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <slot name="actions" />
  </div>
</template>

<style scoped>
/* Tight title/subtitle pairing; the default headline line height leaves a visible gap. */
/* Keeps header actions clear of the floating account avatar in the top-right corner. */
@media (min-width: 600px) {
  .page-header {
    padding-right: 52px;
  }
}
.page-title {
  line-height: 1.2;
  margin-bottom: 2px;
}
</style>
