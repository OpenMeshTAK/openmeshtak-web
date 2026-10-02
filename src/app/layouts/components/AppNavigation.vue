<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import AppLogo from "@/shared/components/AppLogo.vue";
import ThemeToggle from "@/shared/components/ThemeToggle.vue";
import { useSession } from "@/modules/auth/session";
import { navigationFromRoutes, visibleNavigation } from "@/app/router/navigation";
import NavigationEntry from "./NavigationEntry.vue";

const session = useSession();
const router = useRouter();
const { smAndUp } = useDisplay();

// Destinations come from `meta.navigation` in the route table.
const items = computed(() => visibleNavigation(navigationFromRoutes(router.options.routes), (permission) => session.can(permission)));
</script>

<template>
  <!-- Desktop/tablet: slim floating rail on the left. -->
  <nav v-if="smAndUp" class="navigation navigation--rail" aria-label="Main navigation">
    <router-link to="/" class="navigation__logo" aria-label="Dashboard"><AppLogo :size="30" /></router-link>
    <v-divider class="mx-3 mb-2" />
    <div class="navigation__items">
      <NavigationEntry v-for="item in items" :key="item.path" :item="item" rail />
    </div>
    <v-spacer />
    <ThemeToggle />
  </nav>

  <!-- Phones: the same destinations as a floating bar within thumb reach. -->
  <nav v-else class="navigation navigation--bottom" aria-label="Main navigation">
    <NavigationEntry v-for="item in items" :key="item.path" :item="item" :rail="false" />
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
</style>
