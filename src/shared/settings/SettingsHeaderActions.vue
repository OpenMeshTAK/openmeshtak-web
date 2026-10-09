<script setup lang="ts">
import { computed, inject } from "vue";
import { SETTINGS_HEADER_ACTIONS } from "./header-actions";

/**
 * Shows a section's actions, such as "Add channel" or a module switch, in the settings header next
 * to the section title. Outside a settings layout the actions stay where they are written.
 */
const target = inject(SETTINGS_HEADER_ACTIONS, null);
const inLayout = target !== null;
const element = computed(() => target?.value ?? null);
</script>

<template>
  <Teleport v-if="element !== null" :to="element">
    <slot />
  </Teleport>
  <div v-else-if="!inLayout" class="d-flex justify-end ga-2 mb-4">
    <slot />
  </div>
</template>
