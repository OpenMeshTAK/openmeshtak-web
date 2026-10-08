<script setup lang="ts">
import type { LoadState } from "@/shared/composables/useAsyncData";
import ErrorState from "@/shared/components/ErrorState.vue";

/**
 * Frame of every application view: full-width content with the shared spacing, plus the standard
 * loading and error states. Without `state` the content renders directly.
 */
defineProps<{ state?: LoadState; error?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <v-container fluid class="view-content">
    <v-skeleton-loader v-if="state === 'loading'" type="heading, table" />
    <ErrorState v-else-if="state === 'error'" :message="error ?? ''" @retry="$emit('retry')" />
    <slot v-else />
  </v-container>
</template>

<style scoped>
.view-content {
  padding: 20px 24px 24px;
}
</style>
