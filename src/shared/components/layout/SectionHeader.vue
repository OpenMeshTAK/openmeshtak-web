<script setup lang="ts">
/** Title, one-line explanation and actions of a section inside a view, below the page header. */
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="d-flex align-start ga-4 mb-4 flex-wrap flex-md-nowrap">
    <div class="flex-grow-1" style="min-width: 0">
      <h2 class="text-title-large font-weight-medium section-title">{{ title }}</h2>
      <p v-if="description" class="text-body-medium text-medium-emphasis my-0">{{ description }}</p>
    </div>
    <div class="d-flex align-center ga-2 flex-wrap flex-shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.section-title {
  line-height: 1.3;
  margin: 0 0 2px;
}
</style>
