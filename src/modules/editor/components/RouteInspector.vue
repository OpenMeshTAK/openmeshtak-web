<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { mdiArrowDown, mdiArrowUp, mdiPlus, mdiTrashCanOutline } from "@mdi/js";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";
import { reorderRoute } from "../map/route-editing";
type Route = Extract<PackageGeometry, { type: "Route" }>;
const props = defineProps<{ geometry: Route; disabled: boolean }>();
const emit = defineEmits<{ change: [geometry: Route] }>();
const selected = ref(0);
const draft = ref({ name: "", remarks: "", longitude: "", latitude: "", altitude: "" });
const cue = ref<Route["navigationCues"][number]>({ pointId: "", text: "", voice: "", triggers: [] });
const error = ref("");
const point = computed(() => props.geometry.points[selected.value]);
const choices = computed(() => props.geometry.points.map((point, index) => ({ value: index, title: `${index + 1}. ${point.name || point.type}` })));
const options = [
  { key: "method", label: "Method" }, { key: "direction", label: "Direction" },
  { key: "routeType", label: "Route type" }, { key: "order", label: "Order" },
  { key: "transportationType", label: "Transportation type" }, { key: "planningMethod", label: "Planning method" }, { key: "prefix", label: "Waypoint prefix" },
] as const;
watch(() => [props.geometry, selected.value] as const, () => {
  selected.value = Math.min(selected.value, props.geometry.points.length - 1);
  const current = point.value;
  const position = props.geometry.coordinates[selected.value] ?? [];
  draft.value = { name: current?.name ?? "", remarks: current?.remarks ?? "", longitude: String(position[0] ?? ""), latitude: String(position[1] ?? ""), altitude: position[2] === undefined ? "" : String(position[2]) };
  const savedCue = props.geometry.navigationCues.find((item) => item.pointId === current?.id);
  cue.value = savedCue === undefined ? { pointId: current?.id ?? "", text: "", voice: "", triggers: [] } : { ...savedCue, triggers: savedCue.triggers.map((trigger) => ({ ...trigger })) };
  error.value = "";
}, { immediate: true });
function change(geometry: Route): void { if (!props.disabled) emit("change", geometry); }
function commitPoint(): void {
  const longitude = Number(draft.value.longitude);
  const latitude = Number(draft.value.latitude);
  const altitude = draft.value.altitude.trim() === "" ? null : Number(draft.value.altitude);
  if (draft.value.longitude.trim() === "" || draft.value.latitude.trim() === "" || ![longitude, latitude].every(Number.isFinite) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90 || (altitude !== null && !Number.isFinite(altitude))) {
    error.value = "Enter a valid WGS84 position; leave altitude empty when unknown.";
    return;
  }
  error.value = "";
  const coordinates = props.geometry.coordinates.map((position, index) => index === selected.value ? [longitude, latitude, ...(altitude === null ? [] : [altitude])] : position);
  const points = props.geometry.points.map((point, index) => index === selected.value ? { ...point, name: draft.value.name, remarks: draft.value.remarks } : point);
  if (JSON.stringify({ coordinates, points }) !== JSON.stringify({ coordinates: props.geometry.coordinates, points: props.geometry.points })) change({ ...props.geometry, coordinates, points });
}
function addPoint(): void {
  if (props.geometry.points.length >= 10000) return;
  const index = Math.min(selected.value + 1, props.geometry.points.length - 1);
  const a = props.geometry.coordinates[index - 1] ?? [];
  const b = props.geometry.coordinates[index] ?? a;
  const coordinates = [...props.geometry.coordinates];
  const points = [...props.geometry.points];
  coordinates.splice(index, 0, [((a[0] ?? 0) + (b[0] ?? 0)) / 2, ((a[1] ?? 0) + (b[1] ?? 0)) / 2]);
  points.splice(index, 0, { id: crypto.randomUUID(), type: "checkpoint", name: "", remarks: "" });
  change({ ...props.geometry, coordinates, points });
}
function removePoint(): void {
  if (props.geometry.points.length <= 2) return;
  change({ ...props.geometry, coordinates: props.geometry.coordinates.filter((_, index) => index !== selected.value), points: props.geometry.points.filter((_, index) => index !== selected.value), navigationCues: props.geometry.navigationCues.filter((cue) => cue.pointId !== point.value?.id) });
}
function commitCue(): void {
  if (cue.value.triggers.some((trigger) => !Number.isInteger(trigger.value) || trigger.value < 0 || trigger.value > 2147483647)) { error.value = "Cue trigger values must be non-negative whole numbers."; return; }
  error.value = "";
  const others = props.geometry.navigationCues.filter((item) => item.pointId !== cue.value.pointId);
  change({ ...props.geometry, navigationCues: cue.value.text === "" && cue.value.voice === "" && cue.value.triggers.length === 0 ? others : [...others, { ...cue.value, triggers: cue.value.triggers.map((trigger) => ({ ...trigger })) }] });
}
</script>
<template>
  <div class="text-label-medium text-uppercase text-medium-emphasis mb-3">Route points</div>
  <v-select v-model="selected" :items="choices" label="Point" density="compact" />
  <div class="d-flex ga-1 mb-2">
    <v-btn :icon="mdiArrowUp" size="small" variant="text" aria-label="Move route point earlier" :disabled="disabled || selected === 0" @click="change(reorderRoute(geometry, selected, selected - 1))" />
    <v-btn :icon="mdiArrowDown" size="small" variant="text" aria-label="Move route point later" :disabled="disabled || selected === geometry.points.length - 1" @click="change(reorderRoute(geometry, selected, selected + 1))" />
    <v-btn :icon="mdiPlus" size="small" variant="text" aria-label="Insert checkpoint next to this point" :disabled="disabled || geometry.points.length >= 10000" @click="addPoint" />
    <v-btn :icon="mdiTrashCanOutline" size="small" variant="text" aria-label="Remove route point and its navigation cue" :disabled="disabled || geometry.points.length <= 2" @click="removePoint" />
  </div>
  <v-select :model-value="point?.type" :items="[{ title: 'Waypoint', value: 'waypoint' }, { title: 'Checkpoint', value: 'checkpoint' }]" label="Point type" density="compact" :disabled="disabled" @update:model-value="change({ ...geometry, points: geometry.points.map((item, index) => index === selected ? { ...item, type: $event ?? item.type } : item) })" />
  <v-text-field v-model="draft.name" label="Point name" density="compact" maxlength="100" :disabled="disabled" @blur="commitPoint" />
  <v-textarea v-model="draft.remarks" label="Point remarks" rows="2" density="compact" maxlength="2000" :disabled="disabled" @blur="commitPoint" />
  <v-text-field v-model="draft.latitude" label="Point latitude" density="compact" :disabled="disabled" @blur="commitPoint" />
  <v-text-field v-model="draft.longitude" label="Point longitude" density="compact" :disabled="disabled" @blur="commitPoint" />
  <v-text-field v-model="draft.altitude" label="Point altitude (m HAE, optional)" density="compact" :disabled="disabled" @blur="commitPoint" />
  <v-expansion-panels variant="accordion">
    <v-expansion-panel title="Route options">
      <v-expansion-panel-text>
        <v-text-field v-for="option in options" :key="option.key" :model-value="geometry.options[option.key] ?? ''" :label="option.label" maxlength="64" density="compact" :disabled="disabled" @change="change({ ...geometry, options: { ...geometry.options, [option.key]: ($event.target as HTMLInputElement).value } })" />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel title="Navigation cue for this point">
      <v-expansion-panel-text>
        <v-textarea v-model="cue.text" label="Text cue" rows="2" maxlength="2000" density="compact" :disabled="disabled" @blur="commitCue" />
        <v-textarea v-model="cue.voice" label="Voice cue" rows="2" maxlength="2000" density="compact" :disabled="disabled" @blur="commitCue" />
        <div v-for="(trigger, index) in cue.triggers" :key="index">
          <v-select v-model="trigger.mode" :items="[{ title: 'Distance', value: 'd' }, { title: 'Time', value: 't' }]" label="Trigger" density="compact" :disabled="disabled" @update:model-value="commitCue" />
          <v-text-field v-model.number="trigger.value" label="Trigger value" type="number" min="0" step="1" density="compact" :disabled="disabled" @blur="commitCue" />
          <v-btn size="small" variant="text" :disabled="disabled" @click="cue.triggers.splice(index, 1); commitCue()">Remove trigger</v-btn>
        </div>
        <v-btn size="small" variant="text" :disabled="disabled || cue.triggers.length >= 16" @click="cue.triggers.push({ mode: 'd', value: 100 }); commitCue()">Add distance trigger</v-btn>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
  <v-alert v-if="error" type="error" density="compact" class="mt-2">{{ error }}</v-alert>
</template>
