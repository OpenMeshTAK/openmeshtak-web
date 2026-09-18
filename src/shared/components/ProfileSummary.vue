<script setup lang="ts">
import { computed } from "vue";
import type { Schemas } from "@/shared/api/types";
import { takTeamSwatches } from "./tak-team-colors";

const props = defineProps<{ eventName: string; profile: Schemas["ResolvedProfileDto"] }>();

/** Secret channels that a key holder shares on site are named, but marked as such. */
const channelNames = computed(() =>
  props.profile.meshtastic.channels
    .map(({ name, delivery }) => (delivery === "on-site" ? `${name} (handed out on site)` : name))
    .join(", "),
);
</script>

<template>
  <v-card class="pa-5">
    <div class="text-overline text-medium-emphasis">{{ eventName }}</div>
    <div class="text-h4 font-weight-bold text-break mb-2">{{ profile.callsign }}</div>
    <div class="d-flex align-center flex-wrap ga-2 text-body-1">
      <span>{{ profile.group.name }}</span>
      <span aria-hidden="true">·</span>
      <span class="d-inline-flex align-center ga-1">
        <span
          class="d-inline-block rounded-circle border"
          :style="{ width: '14px', height: '14px', background: takTeamSwatches[profile.tak.team] }"
          aria-hidden="true"
        />
        {{ profile.tak.team }}
      </span>
      <span aria-hidden="true">·</span>
      <span>{{ profile.tak.role }}</span>
    </div>

    <v-divider class="my-4" />

    <dl class="profile-facts text-body-2">
      <dt>Event role</dt>
      <dd>{{ profile.eventRole.name }}</dd>
      <dt>Meshtastic</dt>
      <dd>{{ profile.meshtastic.shortName ?? "—" }} · {{ profile.meshtastic.longName }}</dd>
      <dt>Channels</dt>
      <dd>{{ channelNames || "—" }}</dd>
      <dt>Mission groups</dt>
      <dd>{{ profile.missionGroups.join(", ") || "—" }}</dd>
    </dl>
  </v-card>
</template>

<style scoped>
.profile-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
}
.profile-facts dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.profile-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
