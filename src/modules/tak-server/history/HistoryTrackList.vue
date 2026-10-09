<script setup lang="ts">
import { mdiDeleteOutline } from "@mdi/js";
import { computed } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { formatAge, lastKnownAt, type TimelineTrack } from "./track-timeline";

/**
 * The loaded tracks with their color, sender and how old their last known position is at the
 * replay time. Unticked tracks disappear from the map and from the analysis.
 */
const props = defineProps<{
  tracks: Array<{ track: TimelineTrack; color: string }>;
  cursor: number;
  canDelete: boolean;
}>();
const hidden = defineModel<Set<string>>("hidden", { required: true });
const devicesOnly = defineModel<boolean>("devicesOnly", { required: true });
defineEmits<{ focus: [uid: string]; delete: [uid: string] }>();

function toggle(uid: string): void {
  const next = new Set(hidden.value);
  if (next.has(uid)) next.delete(uid);
  else next.add(uid);
  hidden.value = next;
}

const rows = computed(() =>
  props.tracks.map(({ track, color }) => {
    const known = lastKnownAt(track, props.cursor);
    const age = known === null ? null : props.cursor - known.time;
    return {
      track,
      color,
      status: age === null ? "no position yet" : `last position ${formatAge(age)} old`,
      details: [
        track.groupName === null ? track.senderName : `${track.senderName} · ${track.groupName}`,
        `${String(track.pointCount)} positions`,
        track.delayedCount > 0 ? `${String(track.delayedCount)} late` : null,
        track.approximateCount > 0 ? `${String(track.approximateCount)} approximate` : null,
        track.duplicatesDropped > 0 ? `${String(track.duplicatesDropped)} duplicates dropped` : null,
      ].filter((part) => part !== null).join(" · "),
    };
  }),
);
</script>

<template>
  <div>
    <div class="d-flex align-center px-3 pt-3 pb-1 ga-1">
      <div class="text-title-small flex-grow-1">Tracks</div>
      <span class="text-body-small text-medium-emphasis">{{ tracks.length }}</span>
    </div>
    <div class="d-flex align-center px-3 ga-1">
      <v-switch v-model="devicesOnly" label="Only devices" color="primary" density="compact" hide-details inset />
      <InfoHint label="About devices">
        Devices are tracks of the apps' own position reports. Markers that someone placed or moved are hidden. Traffic recorded
        before this distinction existed counts as markers.
      </InfoHint>
    </div>
    <p v-if="tracks.length === 0" class="text-body-medium text-medium-emphasis px-3 pb-3 my-0">No recorded positions in this range.</p>
    <v-list v-else density="compact" lines="three" slim class="pa-1">
      <v-list-item v-for="row in rows" :key="row.track.uid" rounded="md" @click="$emit('focus', row.track.uid)">
        <template #prepend>
          <v-checkbox-btn
            :model-value="!hidden.has(row.track.uid)"
            :color="row.color"
            density="compact"
            :aria-label="`Show ${row.track.label}`"
            @click.stop
            @update:model-value="toggle(row.track.uid)"
          />
        </template>
        <v-list-item-title>
          <span class="track-swatch" :style="{ background: row.color }" />
          {{ row.track.label }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ row.status }}</v-list-item-subtitle>
        <v-list-item-subtitle>{{ row.details }}</v-list-item-subtitle>
        <template v-if="canDelete" #append>
          <v-btn :icon="mdiDeleteOutline" variant="text" size="small" :aria-label="`Delete the recorded positions of ${row.track.label}`" @click.stop="$emit('delete', row.track.uid)" />
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<style scoped>
.track-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 50%;
}
</style>
