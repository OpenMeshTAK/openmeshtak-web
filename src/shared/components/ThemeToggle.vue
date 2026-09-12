<script setup lang="ts">
import { mdiThemeLightDark, mdiWeatherNight, mdiWhiteBalanceSunny } from "@mdi/js";
import { computed } from "vue";
import { useThemePreference } from "@/shared/composables/useThemePreference";

/** Cycles system → light → dark. `list` renders it as a menu entry instead of an icon button. */
defineProps<{ list?: boolean }>();
const theme = useThemePreference();

const appearance = computed(
  () =>
    ({
      system: { icon: mdiThemeLightDark, label: "Theme: system" },
      light: { icon: mdiWhiteBalanceSunny, label: "Theme: light" },
      dark: { icon: mdiWeatherNight, label: "Theme: dark" },
    })[theme.preference.value],
);
</script>

<template>
  <v-list-item v-if="list" :prepend-icon="appearance.icon" :title="appearance.label" @click="theme.cycle" />
  <v-tooltip v-else :text="appearance.label" location="end">
    <template #activator="{ props: tooltip }">
      <v-btn
        v-bind="tooltip"
        :icon="appearance.icon"
        :aria-label="appearance.label"
        variant="text"
        rounded="lg"
        size="44"
        class="text-medium-emphasis"
        @click="theme.cycle"
      />
    </template>
  </v-tooltip>
</template>
