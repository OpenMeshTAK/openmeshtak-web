<script setup lang="ts">
import { provide } from "vue";
import { useDisplay } from "vuetify";
import ProfileMenu from "@/modules/auth/ProfileMenu.vue";
import AppNavigation from "./components/AppNavigation.vue";

const { smAndUp } = useDisplay();

// View headers render the profile menu at the end of their action row.
provide("view-header-profile", ProfileMenu);
</script>

<template>
  <AppNavigation />
  <v-main :class="smAndUp ? 'app-main--rail' : 'app-main--bottom'">
    <router-view />
  </v-main>
</template>

<style scoped>
/* Leave room for the floating navigation. */
.app-main--rail {
  padding-left: 88px !important;
  padding-top: 0 !important;
}
.app-main--bottom {
  padding-top: 0 !important;
  padding-bottom: 96px !important;
}
</style>
