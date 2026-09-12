<script setup lang="ts">
import { computed } from "vue";
import { useDisplay } from "vuetify";
import AppLogo from "@/shared/components/AppLogo.vue";
import ThemeToggle from "@/shared/components/ThemeToggle.vue";
import { useSession } from "@/modules/auth/session";
import { navigationItems } from "./navigation-items";

const session = useSession();
const { smAndUp } = useDisplay();

const visibleItems = computed(() =>
  navigationItems.filter((item) => item.permission === undefined || session.can(item.permission)),
);
</script>

<template>
  <!-- Desktop/tablet: slim floating rail on the left. -->
  <nav v-if="smAndUp" class="navigation navigation--rail" aria-label="Main navigation">
    <router-link to="/" class="navigation__logo" aria-label="Dashboard"><AppLogo :size="30" /></router-link>
    <v-divider class="mx-3 mb-2" />
    <div class="navigation__items">
      <v-tooltip v-for="item in visibleItems" :key="item.to" :text="item.title" location="end">
        <template #activator="{ props: tooltip }">
          <v-btn
            v-bind="tooltip"
            :to="item.to"
            :exact="item.to === '/'"
            :icon="item.icon"
            :aria-label="item.title"
            variant="text"
            rounded="lg"
            size="44"
            class="navigation__item"
          />
        </template>
      </v-tooltip>
    </div>
    <v-spacer />
    <ThemeToggle />
  </nav>

  <!-- Phones: the same destinations as a floating bar within thumb reach. -->
  <nav v-else class="navigation navigation--bottom" aria-label="Main navigation">
    <v-btn
      v-for="item in visibleItems"
      :key="item.to"
      :to="item.to"
      :exact="item.to === '/'"
      :icon="item.icon"
      :aria-label="item.title"
      variant="text"
      rounded="lg"
      size="44"
      class="navigation__item"
    />
  </nav>
</template>

<style scoped>
.navigation {
  position: fixed;
  z-index: 1005;
  display: flex;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.navigation--rail {
  top: 12px;
  bottom: 12px;
  left: 12px;
  width: 64px;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
}
.navigation--bottom {
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  justify-content: space-around;
  padding: 6px;
}
.navigation__logo {
  display: flex;
  padding: 2px 0 10px;
}
.navigation__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.navigation__item {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
/* Vuetify marks router-linked buttons with v-btn--active; fill them like the reference design. */
.navigation__item.v-btn--active {
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}
.navigation__item.v-btn--active :deep(.v-btn__overlay) {
  opacity: 0;
}
</style>
