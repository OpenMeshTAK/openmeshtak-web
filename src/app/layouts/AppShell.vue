<script setup lang="ts">
import {
  mdiAccountGroup,
  mdiCalendarMultiple,
  mdiKeyChain,
  mdiLogout,
  mdiMenu,
  mdiViewDashboard,
} from "@mdi/js";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import type { Permission } from "@/shared/api/types";
import { useSession } from "@/modules/auth/session";

const session = useSession();
const router = useRouter();
const { mdAndUp } = useDisplay();
const drawerOpen = ref(false);

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

const visibleItems = computed(() =>
  items.filter((item) => item.permission === undefined || session.can(item.permission)),
);

async function signOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: "sign-in" });
}
</script>

<template>
  <v-navigation-drawer
    :model-value="mdAndUp || drawerOpen"
    :permanent="mdAndUp"
    :temporary="!mdAndUp"
    @update:model-value="drawerOpen = $event"
  >
    <div class="px-4 py-4 text-subtitle-1 font-weight-bold">OpenMeshTak</div>
    <v-list nav density="comfortable">
      <v-list-item
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.title"
        :exact="item.to === '/'"
      />
    </v-list>
  </v-navigation-drawer>

  <v-app-bar flat border density="comfortable">
    <v-app-bar-nav-icon v-if="!mdAndUp" :icon="mdiMenu" aria-label="Open navigation" @click="drawerOpen = true" />
    <v-spacer />
    <span class="text-body-2 mr-2 text-truncate">{{ session.state.principal?.name }}</span>
    <v-btn variant="text" :prepend-icon="mdiLogout" @click="signOut">Sign out</v-btn>
  </v-app-bar>

  <v-main>
    <router-view />
  </v-main>
</template>
