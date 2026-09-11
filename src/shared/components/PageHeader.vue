<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="d-flex flex-wrap align-center ga-3 mb-6">
    <div class="flex-grow-1" style="min-width: 0">
      <h1 class="text-h5 text-truncate">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <slot name="actions" />
  </div>
</template>
