<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useSession } from "@/modules/auth/session";
import { settingsSections } from "./settings-sections";

/**
 * Instance-wide settings in one place. Each section is its own child route, so a section can be
 * bookmarked and only loads its data when opened.
 */
const session = useSession();
const route = useRoute();
const router = useRouter();

const visibleSections = computed(() => settingsSections.filter((section) => session.can(section.permission)));

// `/admin/settings` itself has no content; open the first section the user may manage.
watchEffect(() => {
  const first = visibleSections.value[0];
  if (route.name === "settings" && first !== undefined) {
    void router.replace({ name: first.name });
  }
});
</script>

<template>
  <ViewContent>
    <ViewHeader title="Settings" subtitle="Instance-wide settings that apply to every event." />
    <EmptyState v-if="visibleSections.length === 0" title="No settings available" text="Your account cannot manage any instance-wide settings." />
    <div v-else class="settings-layout">
      <v-card class="settings-menu pa-2" tag="nav" aria-label="Settings sections">
        <v-list density="comfortable" nav>
          <v-list-item
            v-for="section in visibleSections"
            :key="section.name"
            :to="{ name: section.name }"
            :prepend-icon="section.icon"
            :title="section.title"
          />
        </v-list>
      </v-card>
      <div class="settings-content">
        <router-view />
      </div>
    </div>
  </ViewContent>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.settings-menu {
  position: sticky;
  top: 16px;
}

@media (max-width: 959px) {
  .settings-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-menu {
    position: static;
  }
}
</style>
