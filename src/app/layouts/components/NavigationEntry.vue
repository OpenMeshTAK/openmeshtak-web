<script setup lang="ts">
import { computed, mergeProps } from "vue";
import { useRoute } from "vue-router";
import { isNavigationActive, type NavigationItem } from "@/app/router/navigation";

/**
 * One button of the main navigation. An item with children opens a submenu beside the rail
 * (or above the bottom bar) instead of navigating; the submenu shows one level.
 */
const props = defineProps<{ item: NavigationItem; rail: boolean }>();

const route = useRoute();
const active = computed(() => isNavigationActive(props.item, route));
</script>

<template>
  <v-menu v-if="item.children.length > 0" :location="rail ? 'end' : 'top'" offset="12">
    <template #activator="{ props: menu }">
      <v-tooltip :text="item.title" location="end" :disabled="!rail">
        <template #activator="{ props: tooltip }">
          <v-btn
            v-bind="mergeProps(menu, tooltip)"
            :active="active"
            :icon="item.icon"
            :aria-label="item.title"
            variant="text"
            rounded="lg"
            size="44"
            class="navigation-entry"
          />
        </template>
      </v-tooltip>
    </template>
    <v-card class="navigation-entry__menu pa-2" min-width="220">
      <div class="text-caption text-medium-emphasis px-3 pt-1 pb-2">{{ item.title }}</div>
      <v-list density="compact" nav class="pa-0">
        <v-list-item
          v-for="child in item.children"
          :key="child.path"
          :to="child.path"
          :active="isNavigationActive(child, route)"
          :prepend-icon="child.icon"
          :title="child.title"
          rounded="lg"
        />
      </v-list>
    </v-card>
  </v-menu>

  <v-tooltip v-else :text="item.title" location="end" :disabled="!rail">
    <template #activator="{ props: tooltip }">
      <v-btn
        v-bind="tooltip"
        :to="item.path"
        :active="active"
        :icon="item.icon"
        :aria-label="item.title"
        variant="text"
        rounded="lg"
        size="44"
        class="navigation-entry"
      />
    </template>
  </v-tooltip>
</template>

<style scoped>
.navigation-entry {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
/* Fill the active destination like the reference design. */
.navigation-entry.v-btn--active {
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}
.navigation-entry.v-btn--active :deep(.v-btn__overlay) {
  opacity: 0;
}
/* Same floating surface as the navigation itself. */
.navigation-entry__menu {
  border-radius: 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
</style>
