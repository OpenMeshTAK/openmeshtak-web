<script setup lang="ts">
import ColorInput from "./ColorInput.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiContentCopy, mdiTrashCanOutline } from "@mdi/js";
import { computed, ref, watch } from "vue";
import type {
  PackageGeometry,
  PackageLayerDto,
  PackageObjectDto,
  PackageObjectStyle,
  TakMarker,
  PackageContentDto,
} from "@/modules/data-packages/data-packages.api";
import MarkerSymbolField from "./MarkerSymbolField.vue";
import EllipseDimensions from "./EllipseDimensions.vue";
import RouteInspector from "./RouteInspector.vue";
import PlanningStyleInspector from "./PlanningStyleInspector.vue";
import InspectorToggle from "./InspectorToggle.vue";
import SegmentedControl from "@/shared/components/SegmentedControl.vue";
import GridCoordinateInput from "./GridCoordinateInput.vue";

type ObjectChanges = Partial<{
  name: string;
  description: string | null;
  style: PackageObjectStyle;
  layerId: string;
  geometry: PackageGeometry;
  tak: TakMarker | null;
}>;

const props = withDefaults(defineProps<{ object: PackageObjectDto; layers: PackageLayerDto[]; editable: boolean; eventId?: string; contents?: PackageContentDto[] }>(), { eventId: "", contents: () => [] });
const emit = defineEmits<{ change: [changes: ObjectChanges]; duplicate: []; remove: [] }>();

const name = ref("");
const description = ref("");
const position = ref({ longitude: "", latitude: "", altitude: "", radius: "" });
const height = ref("");
const heightError = ref("");
const dashPattern = ref("");
const dashError = ref("");
const heightUnits = [
  { title: "Client default", value: null },
  { title: "Metres", value: 1 }, { title: "Feet", value: 4 },
  { title: "Kilometres", value: 0 }, { title: "Miles", value: 2 },
  { title: "Yards", value: 3 }, { title: "Nautical miles", value: 5 },
];

watch(
  () => props.object,
  (object) => {
    name.value = object.name;
    description.value = object.description ?? "";
    height.value = object.style.height == null ? "" : String(object.style.height);
    heightError.value = "";
    dashPattern.value = (object.style.dashPattern ?? [8, 4]).join(", ");
    dashError.value = "";
    if (object.geometry.type === "Point" || object.geometry.type === "Circle" || object.geometry.type === "Ellipse") {
      const [longitude, latitude, altitude] = object.geometry.coordinates;
      position.value = {
        longitude: String(longitude ?? ""),
        latitude: String(latitude ?? ""),
        altitude: altitude === undefined ? "" : String(altitude),
        radius: object.geometry.type === "Circle" ? String(object.geometry.radius) : "",
      };
    }
  },
  { immediate: true },
);

const locked = computed(() => props.layers.find(({ id }) => id === props.object.layerId)?.locked === true);
const disabled = computed(() => !props.editable || locked.value);
const vertexCount = computed(() => {
  const { geometry } = props.object;
  return geometry.type === "LineString" || geometry.type === "Rectangle" || geometry.type === "Route" ? geometry.coordinates.length : geometry.type === "Polygon" ? (geometry.coordinates[0]?.length ?? 1) - 1 : 1;
});
const unlockedLayers = computed(() => props.layers.filter((layer) => !layer.locked || layer.id === props.object.layerId));
const kindLabel = computed(() => props.object.style.sector != null ? "Bearing sector" : props.object.style.rangeBearing === true ? "Range & Bearing" : ({
  point: "Marker", line: "Line", polygon: "Polygon", circle: "Circle", rectangle: "Rectangle", ellipse: "Ellipse", route: "Route",
})[props.object.kind]);
const filled = computed(() => ["polygon", "circle", "rectangle", "ellipse"].includes(props.object.kind) || props.object.style.sector != null || props.object.style.corridorWidth != null);
const packagePath = computed(() => (props.eventId ? { eventId: props.eventId, packageId: props.object.packageId } : null));
const strokeStyles = [{ title: "Solid", value: "solid" }, { title: "Dashed", value: "dashed" }, { title: "Dotted", value: "dotted" }, { title: "Outlined", value: "outlined" }, { title: "Custom", value: "custom" }] as const;
const arrowHeads = [{ title: "None", value: "none" }, { title: "Start", value: "start" }, { title: "End", value: "end" }, { title: "Both", value: "both" }];
const extrudeModes = [{ title: "Client default", value: null }, { title: "Cylinder", value: "cylinder" }, { title: "Downward cone", value: "cone_down" }];

function commitText(): void {
  const changes: ObjectChanges = {};
  if (name.value.trim() !== "" && name.value.trim() !== props.object.name) {
    changes.name = name.value.trim();
  }
  const newDescription = description.value.trim() === "" ? null : description.value.trim();
  if (newDescription !== props.object.description) {
    changes.description = newDescription;
  }
  if (Object.keys(changes).length > 0) {
    emit("change", changes);
  }
}

function changeStyle(changes: Partial<PackageObjectStyle>): void {
  if (disabled.value) return;
  emit("change", { style: { ...props.object.style, ...changes } });
}

function commitHeight(): void {
  const text = height.value.trim();
  const value = text === "" ? null : Number(text);
  if (value !== null && (!Number.isFinite(value) || Math.abs(value) > 100_000)) {
    heightError.value = "Enter a height between -100000 and 100000 metres, or leave empty.";
    return;
  }
  heightError.value = "";
  if (value !== (props.object.style.height ?? null)) changeStyle({ height: value });
}

function commitDashes(): void {
  const values = dashPattern.value.split(",").map((part) => Number(part.trim()));
  if (values.length < 2 || values.length > 8 || values.length % 2 !== 0 || values.some((value) => !Number.isInteger(value) || value < 1 || value > 64)) {
    dashError.value = "Enter 2–8 alternating dash/gap lengths, whole pixels from 1 to 64 (e.g. 8, 4).";
    return;
  }
  dashError.value = "";
  if (JSON.stringify(values) !== JSON.stringify(props.object.style.dashPattern)) changeStyle({ dashPattern: values });
}

/** An empty altitude stays unknown; it is never sent as zero. Core validates the values. */
function commitPosition(): void {
  const longitude = Number.parseFloat(position.value.longitude);
  const latitude = Number.parseFloat(position.value.latitude);
  const altitudeText = position.value.altitude.trim();
  const altitude = altitudeText === "" ? null : Number.parseFloat(altitudeText);
  const radius = Number.parseFloat(position.value.radius);
  if (Number.isNaN(longitude) || Number.isNaN(latitude) || (altitude !== null && Number.isNaN(altitude))) {
    return;
  }
  const coordinates = altitude === null ? [longitude, latitude] : [longitude, latitude, altitude];
  if (props.object.geometry.type === "Circle") {
    if (!Number.isNaN(radius)) {
      emit("change", { geometry: { type: "Circle", coordinates, radius } });
    }
  } else if (props.object.geometry.type === "Ellipse") {
    emit("change", { geometry: { ...props.object.geometry, coordinates } });
  } else {
    emit("change", { geometry: { type: "Point", coordinates } });
  }
}
</script>

<template>
  <div class="pa-3">
    <div class="d-flex align-center">
      <div class="text-title-small flex-grow-1">{{ kindLabel }}</div>
      <v-btn v-if="editable" :icon="mdiContentCopy" size="small" variant="text" aria-label="Duplicate object" @click="emit('duplicate')" />
      <v-btn
        v-if="editable"
        :icon="mdiTrashCanOutline"
        size="small"
        variant="text"
        color="error"
        aria-label="Delete object"
        :disabled="locked"
        @click="emit('remove')"
      />
    </div>
    <v-alert v-if="locked" type="info" density="compact" class="mt-2">The layer is locked.</v-alert>

    <section class="inspector-section inspector-section--first">
      <v-text-field v-model="name" label="Name" density="compact" hide-details :disabled="disabled" maxlength="100" @blur="commitText" @keydown.enter="commitText" />
      <v-textarea v-model="description" label="Description" density="compact" rows="1" auto-grow hide-details :disabled="disabled" maxlength="2000" @blur="commitText" />
      <v-select
        :model-value="object.layerId"
        :items="unlockedLayers"
        item-title="name"
        item-value="id"
        label="Layer"
        density="compact"
        hide-details
        :disabled="disabled"
        @update:model-value="emit('change', { layerId: $event })"
      />
    </section>

    <section v-if="object.kind === 'point' && object.style.sector == null" class="inspector-section">
      <div class="text-label-medium text-uppercase text-medium-emphasis">Symbol</div>
      <MarkerSymbolField
        :tak="object.tak"
        :color="object.style.color"
        :disabled="disabled"
        :path="packagePath"
        :contents="contents"
        @change="emit('change', { tak: $event })"
      />
    </section>

    <section class="inspector-section">
      <div class="text-label-medium text-uppercase text-medium-emphasis">Style</div>
      <div class="style-row">
        <span class="style-label">{{ object.kind === 'point' ? 'Colour' : 'Outline' }}</span>
        <ColorInput :model-value="object.style.color" :disabled="disabled" label="Colour" @update:model-value="changeStyle({ color: $event })" />
        <code class="text-body-small flex-grow-1">{{ object.style.color }}</code>
      </div>
      <div v-if="object.kind !== 'point'" class="style-row">
        <span class="style-label">Line</span>
        <SegmentedControl
          :model-value="object.style.strokeStyle ?? 'solid'"
          :options="strokeStyles"
          label="Line style"
          :disabled="disabled"
          @update:model-value="changeStyle({ strokeStyle: $event, ...($event === 'custom' ? { dashPattern: object.style.dashPattern ?? [8, 4] } : {}) })"
        />
      </div>
      <v-text-field v-if="object.style.strokeStyle === 'custom'" v-model="dashPattern" label="Dash / gap lengths (px)" density="compact" :disabled="disabled" :error-messages="dashError" @blur="commitDashes" @keydown.enter="commitDashes" />
      <InfoHint v-if="object.style.strokeStyle === 'custom'" tone="warning" label="Custom pattern in other apps" text="ATAK and KML show a custom dash pattern as a solid line. Solid, dashed, dotted and outlined lines keep their look in ATAK." />
      <div v-if="object.kind !== 'point'" class="style-row">
        <span class="style-label">Width</span>
        <v-slider
          :model-value="object.style.strokeWidth"
          :min="1"
          :max="20"
          :step="1"
          thumb-label
          density="compact"
          hide-details
          aria-label="Line width"
          :disabled="disabled"
          @end="changeStyle({ strokeWidth: $event })"
        />
        <span class="style-value">{{ object.style.strokeWidth }} px</span>
      </div>
      <template v-if="filled">
        <div class="style-row">
          <span class="style-label">Fill</span>
          <ColorInput :model-value="object.style.fillColor ?? object.style.color" :disabled="disabled" label="Fill colour" @update:model-value="changeStyle({ fillColor: $event })" />
          <code v-if="object.style.fillColor" class="text-body-small flex-grow-1">{{ object.style.fillColor }}</code>
          <span v-else class="text-body-small text-medium-emphasis flex-grow-1">Same as outline</span>
          <v-btn v-if="object.style.fillColor" size="small" variant="text" class="text-none" :disabled="disabled" @click="changeStyle({ fillColor: null })">
            Reset
          </v-btn>
        </div>
        <div class="style-row">
          <span class="style-label">Opacity</span>
          <v-slider
            :model-value="object.style.fillOpacity"
            :min="0"
            :max="1"
            :step="0.05"
            density="compact"
            hide-details
            aria-label="Fill opacity"
            :disabled="disabled"
            @end="changeStyle({ fillOpacity: $event })"
          />
          <span class="style-value">{{ Math.round(object.style.fillOpacity * 100) }} %</span>
        </div>
      </template>
      <template v-if="object.kind === 'line' || object.kind === 'route'">
        <div class="d-flex align-center ga-2">
          <div class="text-label-medium text-uppercase text-medium-emphasis">Direction</div>
          <InfoHint label="How arrows look in ATAK" text="A straight arrow between two points appears as a Range & Bearing line with distance and bearing. Any further arrowhead becomes a small separate triangle with a fixed size on the ground. Route direction arrows are only shown in this editor." />
        </div>
        <v-select v-if="object.kind === 'line'" :model-value="object.style.arrowHeads ?? 'none'" :items="arrowHeads" label="Arrowheads" density="compact" hide-details :disabled="disabled" @update:model-value="changeStyle({ arrowHeads: $event })" />
        <InspectorToggle v-else label="Show route direction" :model-value="object.style.routeDirectionArrows ?? false" :disabled="disabled" @update:model-value="changeStyle({ routeDirectionArrows: $event })" />
        <template v-if="(object.style.arrowHeads ?? 'none') !== 'none' || object.style.routeDirectionArrows">
          <div class="style-row">
            <span class="style-label">Head</span>
            <v-slider :model-value="object.style.arrowHeadSize ?? 16" :min="6" :max="64" :step="1" density="compact" hide-details aria-label="Arrowhead size" :disabled="disabled" @end="changeStyle({ arrowHeadSize: $event })" />
            <span class="style-value">{{ object.style.arrowHeadSize ?? 16 }} px</span>
          </div>
          <div v-if="object.kind === 'route'" class="style-row">
            <span class="style-label">Spacing</span>
            <v-slider :model-value="object.style.routeArrowSpacing ?? 80" :min="24" :max="256" :step="1" density="compact" hide-details aria-label="Direction indicator spacing" :disabled="disabled" @end="changeStyle({ routeArrowSpacing: $event })" />
            <span class="style-value">{{ object.style.routeArrowSpacing ?? 80 }} px</span>
          </div>
        </template>
      </template>
    </section>

    <section v-if="object.kind !== 'point' && object.kind !== 'route'" class="inspector-section">
      <div class="text-label-medium text-uppercase text-medium-emphasis">Height</div>
      <div class="d-flex flex-column ga-3">
        <v-text-field
          v-model="height"
          label="Height (m)"
          placeholder="Optional"
          density="compact"
          :disabled="disabled"
          :error-messages="heightError"
          :hide-details="heightError === ''"
          @blur="commitHeight"
          @keydown.enter="commitHeight"
        >
          <template #append-inner><InfoHint label="About shape height" text="Extrusion above or below the shape, separate from vertex altitude. Leave empty when unknown. The map shows the footprint in 2D." /></template>
        </v-text-field>
        <v-select
          :model-value="object.style.heightUnit ?? null"
          :items="heightUnits"
          label="Unit in TAK"
          density="compact"
          hide-details
          :disabled="disabled"
          @update:model-value="changeStyle({ heightUnit: $event })"
        />
      </div>
      <v-select
        v-if="object.kind === 'circle'"
        :model-value="object.style.extrudeMode ?? null"
        :items="extrudeModes"
        label="Extrusion"
        density="compact"
        hide-details
        :disabled="disabled"
        @update:model-value="changeStyle({ extrudeMode: $event })"
      />
    </section>

    <section v-if="object.geometry.type === 'Ellipse'" class="inspector-block">
      <EllipseDimensions :geometry="object.geometry" :disabled="disabled" @change="emit('change', { geometry: $event })" />
    </section>
    <section v-if="object.style.sector != null || object.kind === 'line' || object.kind === 'route'" class="inspector-section">
      <PlanningStyleInspector :geometry="object.geometry" :style="object.style" :disabled="disabled" @change="emit('change', { style: $event })" />
    </section>
    <section v-if="object.geometry.type === 'Route'" class="inspector-block">
      <RouteInspector :geometry="object.geometry" :disabled="disabled" @change="emit('change', { geometry: $event })" />
    </section>

    <section v-if="object.geometry.type !== 'Route'" class="inspector-section">
      <div class="text-label-medium text-uppercase text-medium-emphasis">Position (WGS84)</div>
      <template v-if="object.geometry.type === 'Point' || object.geometry.type === 'Circle' || object.geometry.type === 'Ellipse'">
        <GridCoordinateInput :position="object.geometry.coordinates" :disabled="disabled" @apply="emit('change', { geometry: { ...object.geometry, coordinates: [...$event, ...object.geometry.coordinates.slice(2)] } })" />
        <div class="field-pair">
          <v-text-field v-model="position.latitude" label="Latitude" density="compact" hide-details :disabled="disabled" @blur="commitPosition" @keydown.enter="commitPosition" />
          <v-text-field v-model="position.longitude" label="Longitude" density="compact" hide-details :disabled="disabled" @blur="commitPosition" @keydown.enter="commitPosition" />
        </div>
        <v-text-field
          v-model="position.altitude"
          label="Altitude (m)"
          placeholder="Optional"
          density="compact"
          hide-details
          :disabled="disabled"
          @blur="commitPosition"
          @keydown.enter="commitPosition"
        >
          <template #append-inner>
            <InfoHint label="About altitude" text="Height above the WGS84 ellipsoid (HAE). Leave empty when unknown." />
          </template>
        </v-text-field>
        <v-text-field
          v-if="object.geometry.type === 'Circle'"
          v-model="position.radius"
          label="Radius (m)"
          density="compact"
          hide-details
          :disabled="disabled"
          @blur="commitPosition"
          @keydown.enter="commitPosition"
        />
      </template>
      <p v-else class="text-body-small text-medium-emphasis my-0">
        {{ vertexCount }} vertices. Drag vertices to change the shape; hold Shift and drag the selected drawing to move it as a whole.
      </p>
    </section>
  </div>
</template>

<style scoped>
.inspector-block {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.inspector-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.inspector-section--first {
  margin-top: 12px;
  padding-top: 0;
  border-top: none;
}
.style-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}
.style-label {
  flex: 0 0 56px;
  font-size: 0.8125rem;
}
.style-value {
  flex: 0 0 44px;
  text-align: right;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.style-row :deep(.v-slider.v-input--horizontal) {
  margin-inline: 0;
}
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
