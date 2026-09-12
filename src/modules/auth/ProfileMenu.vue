<script setup lang="ts">
import { mdiLogout } from "@mdi/js";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import ThemeToggle from "@/shared/components/ThemeToggle.vue";
import { useSession } from "./session";

const session = useSession();
const router = useRouter();
const { smAndUp } = useDisplay();

const initials = computed(() =>
  (session.state.principal?.name ?? "?")
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);

async function signOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: "sign-in" });
}
</script>

<template>
  <v-menu location="bottom end" offset="8">
    <template #activator="{ props: menu }">
      <v-btn v-bind="menu" icon variant="text" size="44" aria-label="Account menu">
        <v-avatar color="primary" size="36">
          <span class="text-body-2 font-weight-bold">{{ initials }}</span>
        </v-avatar>
      </v-btn>
    </template>
    <v-card min-width="240" class="pa-2">
      <div class="px-3 pt-2 pb-3">
        <div class="text-subtitle-2 text-truncate">{{ session.state.principal?.name }}</div>
        <div class="text-caption text-medium-emphasis">Signed in</div>
      </div>
      <v-divider />
      <v-list density="compact" nav class="pa-0 pt-2">
        <ThemeToggle v-if="!smAndUp" list />
        <v-list-item :prepend-icon="mdiLogout" title="Sign out" @click="signOut" />
      </v-list>
    </v-card>
  </v-menu>
</template>
