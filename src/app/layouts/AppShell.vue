<script setup lang="ts">
import {
  mdiAccountGroup,
  mdiCalendarMultiple,
  mdiKeyChain,
  mdiThemeLightDark,
  mdiViewDashboard,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
} from "@mdi/js";
import { computed, provide } from "vue";
import { useDisplay } from "vuetify";
import type { Permission } from "@/shared/api/types";
import AppLogo from "@/shared/components/AppLogo.vue";
import { useThemePreference } from "@/shared/composables/useThemePreference";
import AccountMenu from "@/modules/auth/AccountMenu.vue";
import { useSession } from "@/modules/auth/session";

const session = useSession();
const { smAndUp } = useDisplay();
const theme = useThemePreference();

interface NavigationItem {
  title: string;
  icon: string;
  to: string;
  /** Hint only; Core authorizes every request behind these pages. */
  permission?: Permission;
}

const items: NavigationItem[] = [
  { title: "Dashboard", icon: mdiViewDashboard, to: "/" },
  { title: "Events", icon: mdiCalendarMultiple, to: "/admin/events", permission: "events.read" },
  { title: "User groups", icon: mdiAccountGroup, to: "/admin/user-groups", permission: "user-groups.read" },
  {
    title: "Service accounts",
    icon: mdiKeyChain,
    to: "/admin/service-accounts",
    permission: "service-accounts.manage",
  },
];

// Page headers render the account menu in their action row.
provide("page-header-account", AccountMenu);

const visibleItems = computed(() =>
  items.filter((item) => item.permission === undefined || session.can(item.permission)),
);

const themeAppearance = computed(
  () =>
    ({
      system: { icon: mdiThemeLightDark, label: "Theme: system" },
      light: { icon: mdiWhiteBalanceSunny, label: "Theme: light" },
      dark: { icon: mdiWeatherNight, label: "Theme: dark" },
    })[theme.preference.value],
);

</script>

<template>
  <!-- Desktop/tablet: slim floating rail on the left. -->
  <nav v-if="smAndUp" class="app-rail" aria-label="Main navigation">
    <router-link to="/" class="app-rail__logo" aria-label="Dashboard"><AppLogo :size="30" /></router-link>
    <v-divider class="mx-3 mb-2" />

    <div class="app-rail__items">
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
            class="app-rail__item"
            active-class="app-rail__item--active"
          />
        </template>
      </v-tooltip>
    </div>

    <v-spacer />
    <v-tooltip :text="themeAppearance.label" location="end">
      <template #activator="{ props: tooltip }">
        <v-btn
          v-bind="tooltip"
          :icon="themeAppearance.icon"
          :aria-label="themeAppearance.label"
          variant="text"
          rounded="lg"
          size="44"
          class="app-rail__item"
          @click="theme.cycle"
        />
      </template>
    </v-tooltip>
  </nav>

  <!-- Phones: the same destinations as a floating bar within thumb reach. -->
  <nav v-else class="app-bottom-bar" aria-label="Main navigation">
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
      class="app-rail__item"
      active-class="app-rail__item--active"
    />
  </nav>

  <v-main class="app-main" :class="smAndUp ? 'app-main--rail' : 'app-main--bottom'">
    <router-view />
  </v-main>
</template>

<style scoped>
.app-rail {
  position: fixed;
  z-index: 1005;
  top: 12px;
  bottom: 12px;
  left: 12px;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.app-rail__logo {
  display: flex;
  padding: 2px 0 10px;
}
.app-rail__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.app-rail__item {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
/* Vuetify marks router-linked buttons with v-btn--active; fill them like the reference design. */
.app-rail__item.v-btn--active,
.app-rail__item--active {
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}
.app-rail__item.v-btn--active :deep(.v-btn__overlay) {
  opacity: 0;
}
.app-bottom-bar {
  position: fixed;
  z-index: 1005;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  display: flex;
  justify-content: space-around;
  padding: 6px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.app-main--rail {
  padding-left: 88px !important;
  padding-top: 0 !important;
}
.app-main--bottom {
  padding-top: 0 !important;
  padding-bottom: 96px !important;
}
</style>
