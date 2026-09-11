<script setup lang="ts">
defineProps<{ title: string; text?: string; icon?: string }>();
</script>

<template>
  <div class="text-center py-10 px-4">
    <v-icon v-if="icon" :icon="icon" size="48" class="mb-3 text-medium-emphasis" />
    <div class="text-h6 mb-1">{{ title }}</div>
    <p v-if="text" class="text-body-2 text-medium-emphasis mx-auto" style="max-width: 420px">{{ text }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
