<script setup lang="ts">
import { mdiHelpCircleOutline } from "@mdi/js";

/**
 * A small (?) button that explains something on demand, so cards stay short. It opens on click or
 * tap rather than hover, because touch devices have no hover and no action may depend on it.
 */
withDefaults(defineProps<{ text?: string; label?: string }>(), { text: "", label: "More information" });
</script>

<template>
  <v-menu location="bottom" :close-on-content-click="false" max-width="360">
    <template #activator="{ props: activator }">
      <button v-bind="activator" type="button" class="info-hint" :aria-label="label">
        <v-icon :icon="mdiHelpCircleOutline" size="15" />
      </button>
    </template>
    <v-card class="pa-4 text-body-2">
      <slot>{{ text }}</slot>
    </v-card>
  </v-menu>
</template>

<style scoped>
/* Deliberately quiet: the hint supports the text next to it and must not compete with actions. */
.info-hint {
  display: inline-grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
  background: none;
  cursor: pointer;
}

.info-hint:hover,
.info-hint:focus-visible,
.info-hint[aria-expanded="true"] {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.info-hint:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}
</style>
