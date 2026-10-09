<script setup lang="ts">
import { computed } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import type { PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import { toMapGeometry } from "@/modules/editor/map/geometry-codec";
import { timeInArea } from "./track-analysis";
import { formatAge, type TimelineTrack } from "./track-timeline";

/**
 * Post-event analysis of the shown tracks: an activity grid on the map and the time each track
 * spent inside one area drawn on the event's map (polygon, rectangle, circle or ellipse).
 */
const props = defineProps<{ tracks: TimelineTrack[]; objects: PackageObjectDto[] }>();
const coverage = defineModel<boolean>("coverage", { required: true });
const cellMetres = defineModel<number>("cellMetres", { required: true });
const areaId = defineModel<string | null>("areaId", { required: true });

const AREA_TYPES = new Set(["Polygon", "Rectangle", "Circle", "Ellipse"]);
const areas = computed(() =>
  props.objects
    .filter(({ geometry }) => AREA_TYPES.has(geometry.type))
    .map(({ id, name }) => ({ id, name: name.trim() === "" ? "Unnamed area" : name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);
const cellChoices = [50, 100, 250, 500, 1000].map((value) => ({ title: value < 1000 ? `${String(value)} m` : "1 km", value }));
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

const visits = computed(() => {
  const area = props.objects.find(({ id }) => id === areaId.value);
  return area === undefined ? [] : timeInArea(props.tracks, toMapGeometry(area.geometry));
});
</script>

<template>
  <div class="pa-3">
    <div class="text-title-small mb-1">Analysis</div>
    <div class="d-flex align-center ga-2">
      <v-switch v-model="coverage" label="Activity grid" color="primary" density="compact" hide-details inset class="flex-grow-0" />
      <v-select v-if="coverage" v-model="cellMetres" :items="cellChoices" density="compact" hide-details max-width="110" aria-label="Grid cell size" />
      <InfoHint label="About the activity grid">
        Darker cells are where the shown tracks spent more recorded time over the loaded range. Time between two positions counts
        only inside a continuous track; approximate positions are left out.
      </InfoHint>
    </div>

    <div class="d-flex align-center ga-2 mt-3">
      <v-select
        v-model="areaId"
        :items="areas"
        item-title="name"
        item-value="id"
        label="Time in area"
        density="compact"
        hide-details
        clearable
        :disabled="areas.length === 0"
        :no-data-text="'No areas on the event map'"
      />
      <InfoHint label="About time in area">
        Pick a polygon, rectangle, circle or ellipse from the event's Data Packages. The time between two consecutive positions counts
        when both are inside the area; gaps in a track never count.
      </InfoHint>
    </div>
    <template v-if="areaId !== null">
      <p v-if="visits.length === 0" class="text-body-medium text-medium-emphasis mt-2 mb-0">No shown track entered this area.</p>
      <v-table v-else density="compact" class="mt-2">
        <thead>
          <tr>
            <th>Track</th>
            <th>Inside</th>
            <th>Entries</th>
            <th>First – last</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="visit in visits" :key="visit.uid">
            <td>{{ visit.label }}</td>
            <td>{{ formatAge(visit.insideMs) }}</td>
            <td>{{ visit.entries }}</td>
            <td class="text-no-wrap">
              {{ visit.firstInside === null ? "" : timeFormat.format(visit.firstInside) }} –
              {{ visit.lastInside === null ? "" : timeFormat.format(visit.lastInside) }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </template>
  </div>
</template>
