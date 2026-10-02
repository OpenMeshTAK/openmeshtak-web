<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { navigationFromRoutes, visibleNavigation } from "@/app/router/navigation";
import { useSession } from "@/modules/auth/session";

/**
 * Frame for the instance-wide settings sections. Each section is its own child route, so it can
 * be bookmarked and only loads its data when opened; the main navigation lists the sections.
 */
const session = useSession();
const route = useRoute();
const router = useRouter();

const sections = computed(() => {
  const settings = route.matched.find((record) => record.name === "settings");
  return visibleNavigation(navigationFromRoutes(settings?.children ?? [], settings?.path), (permission) => session.can(permission));
});

// `/admin/settings` itself has no content; open the first section the user may manage.
watchEffect(() => {
  const first = sections.value[0];
  if (route.name === "settings" && first !== undefined) {
    void router.replace(first.path);
  }
});
</script>

<template>
  <ViewContent>
    <ViewHeader title="Settings" subtitle="Instance-wide settings that apply to every event." />
    <EmptyState v-if="sections.length === 0" title="No settings available" text="Your account cannot manage any instance-wide settings." />
    <router-view v-else />
  </ViewContent>
</template>
