<script setup lang="ts">
import { inject, type Component } from "vue";

defineProps<{ title: string; subtitle?: string }>();

/**
 * The app shell provides its account menu so every page shows it in the same row as the page
 * actions. Injecting keeps `shared` independent of product modules.
 */
const profileMenu = inject<Component | null>("view-header-profile", null);
</script>

<template>
  <div class="view-header mb-4">
    <div class="view-header__title">
      <h1 class="text-h5 text-truncate page-title">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis text-truncate">{{ subtitle }}</div>
    </div>
    <div class="view-header__actions">
      <slot name="actions" />
    </div>
    <component :is="profileMenu" v-if="profileMenu" class="view-header__profile" />
  </div>
</template>

<style scoped>
.view-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.view-header__title {
  flex: 1 1 0;
  min-width: 0;
}

.view-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.view-header__actions:empty {
  display: none;
}

/* Tight title/subtitle pairing; the default headline line height leaves a visible gap. */
.page-title {
  line-height: 1.2;
  margin-bottom: 2px;
}

/* On phones the title shares the first row with the account menu; actions get their own row. */
@media (max-width: 599px) {
  .view-header__profile {
    order: 1;
  }

  .view-header__actions {
    order: 2;
    flex-basis: 100%;
  }

  .view-header__actions > :deep(*) {
    flex: 1 1 auto;
  }
}
</style>
