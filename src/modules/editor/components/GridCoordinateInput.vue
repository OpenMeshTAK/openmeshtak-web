<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { fromMgrs, fromUtm, toMgrs, toUtm } from "../map/coordinate-input";
const props = defineProps<{ position: number[]; disabled: boolean }>();
const emit = defineEmits<{ apply: [position: number[]] }>();
const mode = ref("MGRS");
const grid = ref("");
const draft = ref({ zone: "", hemisphere: "N" as "N" | "S", easting: "", northing: "" });
const error = ref("");
watch(() => props.position, (position) => {
  try {
    grid.value = toMgrs(position);
    const utm = toUtm(position);
    draft.value = { zone: String(utm.zone), hemisphere: utm.hemisphere, easting: String(utm.easting), northing: String(utm.northing) };
    error.value = "";
  } catch (failure) { grid.value = ""; error.value = failure instanceof Error ? failure.message : "The position cannot be converted."; }
}, { immediate: true });
const preview = computed(() => {
  try {
    if (mode.value === "MGRS") return fromMgrs(grid.value);
    if ([draft.value.zone, draft.value.easting, draft.value.northing].some((text) => text.trim() === "")) return null;
    return { position: fromUtm({ zone: Number(draft.value.zone), hemisphere: draft.value.hemisphere, easting: Number(draft.value.easting), northing: Number(draft.value.northing) }), resolution: null };
  } catch { return null; }
});
function apply(): void {
  if (props.disabled) return;
  try {
    const value = mode.value === "MGRS" ? fromMgrs(grid.value).position : fromUtm({ zone: Number(draft.value.zone), hemisphere: draft.value.hemisphere, easting: Number(draft.value.easting), northing: Number(draft.value.northing) });
    emit("apply", value);
    error.value = "";
  } catch (failure) { error.value = failure instanceof Error ? failure.message : "Enter a valid coordinate."; }
}
</script>
<template>
  <div class="d-flex flex-column ga-2">
    <div class="d-flex align-center ga-2">
      <v-select v-model="mode" :items="['MGRS', 'UTM']" label="Grid" density="compact" hide-details class="grid-mode" />
      <v-text-field v-if="mode === 'MGRS'" v-model="grid" label="MGRS" density="compact" hide-details :disabled="disabled" />
      <InfoHint label="Grid precision" text="WGS84 decimal coordinates remain stored without rounding. MGRS names a grid cell: Apply uses its centre and the shown resolution. Viewing or switching formats never changes a position. UTM values use WGS84; altitude stays in its own field." />
    </div>
    <template v-if="mode === 'UTM'">
      <div class="grid-pair">
        <v-text-field v-model="draft.zone" label="Zone" type="number" density="compact" hide-details :disabled="disabled" />
        <v-select v-model="draft.hemisphere" :items="['N', 'S']" label="Hemisphere" density="compact" hide-details :disabled="disabled" />
        <v-text-field v-model="draft.easting" label="Easting (m)" density="compact" hide-details :disabled="disabled" />
        <v-text-field v-model="draft.northing" label="Northing (m)" density="compact" hide-details :disabled="disabled" />
      </div>
    </template>
    <div v-if="preview || error" class="d-flex align-center ga-2">
      <span v-if="error" class="text-body-small text-error flex-grow-1">{{ error }}</span>
      <span v-else-if="preview" class="text-body-small text-medium-emphasis flex-grow-1">
        {{ preview.position[1]?.toFixed(7) }}, {{ preview.position[0]?.toFixed(7) }}<template v-if="preview.resolution !== null"> · {{ preview.resolution }} m cell centre</template>
      </span>
      <v-btn :disabled="disabled || preview === null" variant="text" size="small" color="primary" class="text-none" @click="apply">Apply</v-btn>
    </div>
  </div>
</template>

<style scoped>
.grid-mode {
  flex: 0 0 112px;
}
.grid-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
