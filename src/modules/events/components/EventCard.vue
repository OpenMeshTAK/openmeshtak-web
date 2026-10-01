<script setup lang="ts">
import { mdiCalendarRange, mdiEarth } from "@mdi/js";
import { computed } from "vue";
import { formatEventDates, scheduleHint } from "../event-schedule";
import type { EventDto } from "../events.api";
import EventStatusBadge from "./EventStatusBadge.vue";

/** One event in the overview; the whole card opens the event. */
const props = defineProps<{ event: EventDto }>();

const dates = computed(() => formatEventDates(props.event));
const hint = computed(() => scheduleHint(props.event));
</script>

<template>
  <v-card :to="{ name: 'event-detail', params: { eventId: event.id } }" class="event-card pa-5">
    <div class="d-flex align-start ga-3">
      <div class="flex-grow-1" style="min-width: 0">
        <div class="text-subtitle-1 font-weight-medium text-break">{{ event.name }}</div>
        <div class="text-caption text-medium-emphasis text-truncate">{{ event.slug }}</div>
      </div>
      <EventStatusBadge :status="event.status" />
    </div>

    <div class="event-card__facts text-body-2 mt-4">
      <div class="d-flex align-center ga-2">
        <v-icon :icon="mdiCalendarRange" size="16" class="text-medium-emphasis" aria-hidden="true" />
        <span>{{ dates ?? "No dates set" }}</span>
        <span v-if="hint && event.status !== 'archived'" class="text-medium-emphasis">· {{ hint }}</span>
      </div>
      <div class="d-flex align-center ga-2 text-medium-emphasis">
        <v-icon :icon="mdiEarth" size="16" aria-hidden="true" />
        <span class="text-truncate">{{ event.timeZone }}</span>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.event-card {
  height: 100%;
}

.event-card__facts {
  display: grid;
  gap: 6px;
}
</style>
