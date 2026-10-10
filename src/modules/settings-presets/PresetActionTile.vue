<script setup lang="ts">
import { mdiChevronRight } from "@mdi/js";

/** One preset action as a clickable tile: an icon, the action in words and what it does. */
defineProps<{
  icon: string;
  title: string;
  description: string;
  settingId: string;
  disabled?: boolean;
  loading?: boolean;
}>();
defineEmits<{ click: [] }>();
</script>

<template>
  <v-card :data-setting-id="settingId" :disabled="disabled || loading" class="action-tile" @click="$emit('click')">
    <div class="d-flex align-center ga-4 pa-4">
      <v-avatar color="primary" variant="tonal" rounded="lg" size="44"><v-icon :icon="icon" /></v-avatar>
      <div class="flex-grow-1 action-tile__text">
        <div class="text-body-large font-weight-medium">{{ title }}</div>
        <div class="text-body-small text-medium-emphasis">{{ description }}</div>
      </div>
      <v-progress-circular v-if="loading" indeterminate size="20" />
      <v-icon v-else :icon="mdiChevronRight" class="text-medium-emphasis" />
    </div>
  </v-card>
</template>

<style scoped>
.action-tile__text {
  min-width: 0;
}
</style>
