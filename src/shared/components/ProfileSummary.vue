<script setup lang="ts">
import { mdiAccountGroup, mdiMapMarkerAccount, mdiShieldAccount, mdiTimerSand } from "@mdi/js";
import { computed } from "vue";
import type { Schemas } from "@/shared/api/types";
import { takTeamSwatches } from "./tak-team-colors";

const props = defineProps<{ eventName: string; profile: Schemas["ResolvedProfileDto"] }>();

/**
 * The TAK team color is event data, so it only appears as a small swatch next to the team name and
 * never as a UI color. An outline keeps light swatches such as White visible on the surface.
 */
const teamSwatch = computed(() => takTeamSwatches[props.profile.tak.team]);
/** `null` in TAK-only events, which have no radio name or channels. */
const meshtasticName = computed(() => {
  if (props.profile.meshtastic === null) {
    return null;
  }
  const { shortName, longName } = props.profile.meshtastic;
  return shortName === null ? longName : `${shortName} · ${longName}`;
});
</script>

<template>
  <v-card class="profile-summary">
    <div class="profile-summary__body">
      <div class="profile-summary__identity">
        <div class="text-label-medium text-uppercase text-medium-emphasis text-truncate">{{ eventName }}</div>
        <div class="text-headline-medium font-weight-bold text-break callsign">{{ profile.callsign }}</div>
        <div class="d-flex flex-wrap ga-2 mt-3">
          <v-chip size="small" label :prepend-icon="mdiAccountGroup">{{ profile.group.name }}</v-chip>
          <v-chip size="small" label>
            <template #prepend>
              <span class="team-dot mr-2" :style="{ background: teamSwatch }" aria-hidden="true" />
            </template>
            {{ profile.tak.team }} team
          </v-chip>
          <v-chip size="small" label :prepend-icon="mdiMapMarkerAccount">{{ profile.tak.role }}</v-chip>
        </div>
      </div>

      <dl class="profile-facts text-body-medium">
        <div>
          <dt>Event role</dt>
          <dd class="d-flex align-center ga-1">
            <v-icon :icon="mdiShieldAccount" size="16" class="text-medium-emphasis" aria-hidden="true" />
            {{ profile.eventRole.name }}
          </dd>
        </div>
        <div v-if="meshtasticName !== null">
          <dt>Meshtastic name</dt>
          <dd>{{ meshtasticName }}</dd>
        </div>
        <div v-if="profile.meshtastic" class="profile-facts__wide">
          <dt>Channels</dt>
          <dd v-if="profile.meshtastic.channels.length === 0">—</dd>
          <dd v-else class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="channel in profile.meshtastic.channels"
              :key="channel.id"
              size="x-small"
              variant="outlined"
              label
              :prepend-icon="channel.delivery === 'on-site' ? mdiTimerSand : undefined"
            >
              {{ channel.name }}<template v-if="channel.delivery === 'on-site'">&nbsp;· handed out on site</template>
            </v-chip>
          </dd>
        </div>
      </dl>
    </div>
  </v-card>
</template>

<style scoped>
.profile-summary__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 40px;
  min-width: 0;
  padding: 20px 24px;
}

.profile-summary__identity {
  flex: 1 1 280px;
  min-width: 0;
}

.callsign {
  line-height: 1.15;
}

.team-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(var(--v-theme-on-surface), 0.3);
}

.profile-facts {
  display: grid;
  flex: 1 1 320px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
  margin: 0;
}

.profile-facts__wide {
  grid-column: 1 / -1;
}

.profile-facts dt {
  margin-bottom: 2px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.profile-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 599px) {
  .profile-summary__body {
    padding: 16px;
  }

  .profile-facts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
