<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InspectorToggle from "./InspectorToggle.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import type { PackageGeometry, PackageObjectStyle } from "@/modules/data-packages/data-packages.api";
import { DISTANCE_UNITS } from "../map/range-bearing";
const props = defineProps<{ geometry: PackageGeometry; style: PackageObjectStyle; disabled: boolean }>();
const emit = defineEmits<{ change: [style: PackageObjectStyle] }>();
const draft = ref({ heading: "0", sweep: "60", radius: "100", width: "10" });
const error = ref("");
const tacticalCatalog = [
  { entity: "110100", title: "Boundary", type: "LineString", min: 2, modifiers: ["B", "T", "T1", "AS"] },
  { entity: "140300", title: "Phase line", type: "LineString", min: 2, modifiers: ["T"] },
  { entity: "150200", title: "Assembly area", type: "Polygon", min: 3, modifiers: ["T"] },
  { entity: "151401", title: "Axis of advance: airborne/aviation", type: "LineString", min: 3, modifiers: ["T", "W", "W1"] },
  { entity: "151404", title: "Axis of advance: supporting attack", type: "LineString", min: 3, modifiers: ["T", "W", "W1"] },
];
const tacticalChoices = computed(() => tacticalCatalog.filter((item) => item.type === props.geometry.type).map((item) => ({ title: item.title, value: item.entity })));
const tacticalDefinition = computed(() => tacticalCatalog.find((item) => item.entity === props.style.tacticalGraphic?.sidc.slice(10, 16)));
function tactical(entity: string | null): void {
  if (entity === null) { change({ tacticalGraphic: null }); return; }
  const definition = tacticalCatalog.find((item) => item.entity === entity);
  const count = props.geometry.type === "LineString" ? props.geometry.coordinates.length : props.geometry.type === "Polygon" ? (props.geometry.coordinates[0]?.length ?? 1) - 1 : 0;
  if (definition === undefined || count < definition.min) { error.value = `Draw at least ${definition?.min ?? 2} control points for this graphic.`; return; }
  change({ tacticalGraphic: { sidc: `1103250000${entity}0000`, modifiers: {} }, corridorWidth: null, rangeBearing: false, arrowHeads: "none" });
}
function modifier(code: string, value: string): void {
  if (props.style.tacticalGraphic == null) return;
  change({ tacticalGraphic: { ...props.style.tacticalGraphic, modifiers: { ...props.style.tacticalGraphic.modifiers, [code]: value } } });
}
const line = computed(() => props.geometry.type === "LineString" || props.geometry.type === "Route");
watch(() => props.style, (style) => {
  draft.value = { heading: String(style.sector?.heading ?? 0), sweep: String(style.sector?.sweep ?? 60), radius: String(style.sector?.radius ?? 100), width: String(style.corridorWidth ?? 10) };
  error.value = "";
}, { immediate: true });
function change(changes: Partial<PackageObjectStyle>): void { if (!props.disabled) emit("change", { ...props.style, ...changes }); }
function numeric(): void {
  if (props.disabled) return;
  const heading = Number(draft.value.heading), sweep = Number(draft.value.sweep), radius = Number(draft.value.radius), width = Number(draft.value.width);
  if (props.style.sector != null) {
    if ([draft.value.heading, draft.value.sweep, draft.value.radius].some((value) => value.trim() === "") || ![heading, sweep, radius].every(Number.isFinite) || heading < 0 || heading > 360 || sweep < 1 || sweep > 360 || radius < 0.1 || radius > 100000) { error.value = "Heading 0–360°, sweep 1–360°, radius 0.1–100000 m."; return; }
    if (heading !== props.style.sector.heading || sweep !== props.style.sector.sweep || radius !== props.style.sector.radius) change({ sector: { ...props.style.sector, heading, sweep, radius } });
  } else if (props.style.corridorWidth != null) {
    if (draft.value.width.trim() === "" || !Number.isFinite(width) || width < 1 || width > 10000) { error.value = "Enter a width between 1 and 10000 metres."; return; }
    if (width !== props.style.corridorWidth) change({ corridorWidth: width });
  }
  error.value = "";
}
</script>
<template>
  <section class="d-flex flex-column ga-2">
    <div class="d-flex align-center ga-2">
      <span class="text-label-medium text-uppercase text-medium-emphasis">Planning</span>
      <InfoHint label="How this looks in ATAK" text="Range & Bearing, sectors, range rings and bullseyes appear in ATAK as the matching ATAK objects. A corridor along a line appears as a safety distance; along a route, ATAK gets an extra area. A sector with decimal values, a full circle or more than 60 km appears as a plain area." />
    </div>
    <InspectorToggle label="Show label" :model-value="style.labelVisible ?? true" :disabled="disabled" @update:model-value="change({ labelVisible: $event })" />
    <template v-if="style.sector != null">
      <v-text-field v-for="field in (['heading', 'sweep', 'radius'] as const)" :key="field" v-model="draft[field]" :label="field === 'heading' ? 'True heading (°)' : field === 'sweep' ? 'Sweep (°)' : 'Radius (m)'" type="number" density="compact" hide-details :disabled="disabled" @blur="numeric" @keydown.enter="numeric" />
      <InspectorToggle label="Show sector" :model-value="style.sector.visible ?? true" :disabled="disabled" @update:model-value="change({ sector: { ...style.sector!, visible: $event } })" />
      <InspectorToggle label="Range and bearing labels" :model-value="style.sector.displayLabels ?? false" :disabled="disabled" @update:model-value="change({ sector: { ...style.sector!, displayLabels: $event } })" />
      <v-number-input :model-value="style.sector.rangeLines ?? 100" label="Range-line spacing (m)" :min="1" :max="60000" density="compact" control-variant="hidden" hide-details :disabled="disabled" @update:model-value="change({ sector: { ...style.sector!, rangeLines: $event ?? 100 } })" />
    </template>
    <template v-if="geometry.type === 'LineString' && geometry.coordinates.length === 2 && style.tacticalGraphic == null">
      <InspectorToggle label="Range & Bearing" :model-value="style.rangeBearing ?? false" :disabled="disabled" @update:model-value="change({ rangeBearing: $event, arrowHeads: $event ? 'end' : 'none' })" />
      <template v-if="style.rangeBearing">
        <v-select :model-value="style.distanceUnit ?? 'm'" :items="DISTANCE_UNITS" label="Distance unit" density="compact" hide-details :disabled="disabled" @update:model-value="change({ distanceUnit: $event })" />
        <v-select :model-value="style.bearingUnit ?? 'degrees'" :items="['degrees', 'mils', 'radians', 'warsaw-mils', 'streck', 'clock']" label="True bearing unit" density="compact" hide-details :disabled="disabled" @update:model-value="change({ bearingUnit: $event })" />
      </template>
    </template>
    <template v-if="tacticalChoices.length > 0">
      <v-select :model-value="style.tacticalGraphic?.sidc.slice(10, 16) ?? null" :items="tacticalChoices" label="Tactical graphic (2525D)" clearable density="compact" hide-details :disabled="disabled" @update:model-value="tactical" />
      <template v-if="style.tacticalGraphic && tacticalDefinition">
        <v-text-field v-for="code in tacticalDefinition.modifiers" :key="code" :model-value="style.tacticalGraphic.modifiers[code] ?? ''" :label="code === 'T' ? 'Designation' : code === 'T1' ? 'Second designation' : code === 'B' ? 'Echelon' : code === 'AS' ? 'Country' : code === 'W' ? 'Start DTG' : 'End DTG'" maxlength="100" density="compact" hide-details :disabled="disabled" @change="modifier(code, ($event.target as HTMLInputElement).value)" />
      </template>
    </template>
    <template v-if="geometry.type === 'Circle'">
      <InspectorToggle label="Range rings" :model-value="style.rangeCircle ?? false" :disabled="disabled" @update:model-value="change({ rangeCircle: $event, rangeRings: 1, bullseye: null })" />
      <v-number-input v-if="style.rangeCircle" :model-value="style.rangeRings ?? 1" label="Ring count" :min="1" :max="10" :precision="0" density="compact" control-variant="split" hide-details :disabled="disabled" @update:model-value="change({ rangeRings: $event ?? 1 })" />
      <InspectorToggle label="Bullseye" :model-value="style.bullseye != null" :disabled="disabled" @update:model-value="change({ rangeCircle: false, rangeRings: 1, bullseye: $event ? { ringDistance: geometry.radius / 3, ringCount: 3, ringsVisible: true, edgeToCenter: false } : null })" />
      <template v-if="style.bullseye">
        <v-number-input :model-value="style.bullseye.ringDistance" label="Ring spacing (m)" :min="0.1" :max="100000" density="compact" control-variant="hidden" hide-details :disabled="disabled" @update:model-value="change({ bullseye: { ...style.bullseye!, ringDistance: $event ?? 1 } })" />
        <v-number-input :model-value="style.bullseye.ringCount" label="Ring count" :min="1" :max="10" :precision="0" density="compact" control-variant="split" hide-details :disabled="disabled" @update:model-value="change({ bullseye: { ...style.bullseye!, ringCount: $event ?? 1 } })" />
        <InspectorToggle label="Show rings" :model-value="style.bullseye.ringsVisible" :disabled="disabled" @update:model-value="change({ bullseye: { ...style.bullseye!, ringsVisible: $event } })" />
        <InspectorToggle label="Bearing toward centre" :model-value="style.bullseye.edgeToCenter" :disabled="disabled" @update:model-value="change({ bullseye: { ...style.bullseye!, edgeToCenter: $event } })" />
      </template>
    </template>
    <template v-if="line && style.tacticalGraphic == null">
      <InspectorToggle label="Corridor" :model-value="style.corridorWidth != null" :disabled="disabled" @update:model-value="change({ corridorWidth: $event ? 10 : null })" />
      <v-text-field v-if="style.corridorWidth != null" v-model="draft.width" label="Full width (m)" type="number" density="compact" hide-details :disabled="disabled" @blur="numeric" @keydown.enter="numeric" />
    </template>
    <template v-if="geometry.type !== 'Point' && geometry.type !== 'Route' && !style.rangeBearing && !style.bullseye && style.corridorWidth == null && (style.arrowHeads ?? 'none') === 'none'">
      <InspectorToggle label="Minimum safe distance" :model-value="style.minimumSafeDistance != null" :disabled="disabled" @update:model-value="change({ minimumSafeDistance: $event ? 10 : null })" />
      <v-number-input v-if="style.minimumSafeDistance != null" :model-value="style.minimumSafeDistance" label="Safe distance (m)" :min="0.1" :max="5000" density="compact" control-variant="hidden" hide-details :disabled="disabled" @update:model-value="change({ minimumSafeDistance: $event ?? 10 })" />
    </template>
    <div v-if="error" class="text-body-small text-error">{{ error }}</div>
  </section>
</template>
