<script setup lang="ts">
/**
 * One block of a settings page: a card with a short title and explanation on top. The content
 * brings its own padding, so it can split the card with dividers.
 */
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <v-card tag="section">
    <div class="px-4 pt-3">
      <h2 class="text-title-medium font-weight-medium ma-0">{{ title }}</h2>
      <p v-if="description" class="text-body-medium text-medium-emphasis ma-0">{{ description }}</p>
    </div>
    <slot />
  </v-card>
</template>
