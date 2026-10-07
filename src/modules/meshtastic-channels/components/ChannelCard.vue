<script setup lang="ts">
import {
  mdiAccountGroup,
  mdiAccountKey,
  mdiArrowDown,
  mdiArrowUp,
  mdiCloudSync,
  mdiCrosshairsGps,
  mdiDelete,
  mdiDotsVertical,
  mdiKeyVariant,
  mdiLock,
  mdiLockOpenVariant,
  mdiShieldLock,
  mdiStar,
} from "@mdi/js";
import { computed } from "vue";
import type { MeshtasticChannelDto } from "../meshtastic-channels.api";
import { positionPrecisionLabel } from "../position-precision";

/**
 * One channel in device order. Status is spelled out with icon and text, never by color alone;
 * Edit is the visible action, everything else lives in the menu with Delete set apart.
 */
const props = defineProps<{
  channel: MeshtasticChannelDto;
  position: number;
  /** Names of the selected groups, roles and members, already resolved by the panel. */
  audience: string[];
  keyHolders: string[];
  /** `null` when member data is unavailable to the viewer. */
  recipientCount: number | null;
  editable: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{
  edit: [];
  key: [];
  release: [];
  remove: [];
  move: [offset: -1 | 1];
}>();

const keyLabels: Record<MeshtasticChannelDto["psk"]["kind"], string> = {
  none: "Unencrypted",
  default: "Public default key",
  aes128: "AES-128",
  aes256: "AES-256",
};

const audienceText = computed(() => {
  if (props.channel.primary) {
    return "Every member";
  }
  return props.audience.length === 0 ? "Nobody selected yet" : props.audience.join(", ");
});
const mqtt = computed(() =>
  [props.channel.uplinkEnabled ? "uplink" : null, props.channel.downlinkEnabled ? "downlink" : null]
    .filter(Boolean)
    .join(" + "),
);
const withheld = computed(() => props.channel.secret && props.channel.releasedAt === null);
</script>

<template>
  <div class="channel-row d-flex align-start ga-4 pa-4">
    <v-avatar :color="channel.primary ? 'primary' : 'surface-variant'" size="40" rounded="lg" class="flex-shrink-0">
      <span class="text-title-medium font-weight-bold">{{ position }}</span>
    </v-avatar>

    <div class="flex-grow-1" style="min-width: 0">
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <span class="text-title-medium font-weight-medium text-break">{{ channel.name }}</span>
        <v-chip v-if="channel.primary" size="small" color="primary" variant="tonal" label :prepend-icon="mdiStar">
          Primary
        </v-chip>
        <v-chip
          v-if="channel.secret"
          size="small"
          :color="withheld ? 'warning' : 'success'"
          variant="tonal"
          label
          :prepend-icon="withheld ? mdiLock : mdiLockOpenVariant"
        >
          {{ withheld ? "Secret · handed out on site" : "Secret · released" }}
        </v-chip>
      </div>

      <div class="facts text-body-medium">
        <span class="fact">
          <v-icon :icon="mdiAccountGroup" size="16" />
          <span class="text-truncate">{{ audienceText }}</span>
          <span v-if="recipientCount !== null" class="text-medium-emphasis text-no-wrap">
            · {{ recipientCount }} {{ recipientCount === 1 ? "member" : "members" }}
          </span>
        </span>
        <span v-if="channel.secret" class="fact">
          <v-icon :icon="mdiAccountKey" size="16" />
          <span class="text-truncate">
            Key holders: {{ keyHolders.length === 0 ? "none" : keyHolders.join(", ") }}
          </span>
        </span>
        <span class="fact text-medium-emphasis">
          <v-icon :icon="mdiShieldLock" size="16" />
          {{ keyLabels[channel.psk.kind] }} · key v{{ channel.psk.version }}
        </span>
        <span class="fact text-medium-emphasis">
          <v-icon :icon="mdiCrosshairsGps" size="16" />
          {{ positionPrecisionLabel(channel.positionPrecision) }}
        </span>
        <span v-if="mqtt" class="fact text-medium-emphasis">
          <v-icon :icon="mdiCloudSync" size="16" />
          MQTT {{ mqtt }}
        </span>
      </div>
    </div>

    <div class="d-flex align-center ga-1 flex-shrink-0">
      <v-btn v-if="editable" variant="tonal" size="small" @click="emit('edit')">Edit</v-btn>
      <v-menu location="bottom end">
        <template #activator="{ props: activator }">
          <v-btn v-bind="activator" :icon="mdiDotsVertical" variant="text" size="small" :aria-label="`More actions for ${channel.name}`" />
        </template>
        <v-list density="compact" min-width="220">
          <v-list-item :prepend-icon="mdiKeyVariant" title="Channel key" @click="emit('key')" />
          <template v-if="editable">
            <v-list-item
              v-if="withheld"
              :prepend-icon="mdiLockOpenVariant"
              title="Release to audience"
              @click="emit('release')"
            />
            <v-list-item :prepend-icon="mdiArrowUp" title="Move up" :disabled="first || busy" @click="emit('move', -1)" />
            <v-list-item :prepend-icon="mdiArrowDown" title="Move down" :disabled="last || busy" @click="emit('move', 1)" />
            <v-divider class="my-1" />
            <v-list-item :prepend-icon="mdiDelete" title="Delete channel" base-color="error" @click="emit('remove')" />
          </template>
        </v-list>
      </v-menu>
    </div>
  </div>
</template>

<style scoped>
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
}
.fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}
</style>
