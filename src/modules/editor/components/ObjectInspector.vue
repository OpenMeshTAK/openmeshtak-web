<script setup lang="ts">
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
const kindLabel = computed(() => ({
  point: "Marker", line: "Line", polygon: "Polygon", circle: "Circle", rectangle: "Rectangle", ellipse: "Ellipse", route: "Route",
})[props.object.kind]);
const filled = computed(() => ["polygon", "circle", "rectangle", "ellipse"].includes(props.object.kind));
const packagePath = computed(() => (props.eventId ? { eventId: props.eventId, packageId: props.object.packageId } : null));
const strokeStyles = [{ title: "Solid", value: "solid" }, { title: "Dashed", value: "dashed" }] as const;
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

    <section v-if="object.kind === 'point'" class="inspector-section">
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
        <input
          type="color"
          class="color-input"
          :value="object.style.color.toLowerCase()"
          :disabled="disabled"
          aria-label="Colour"
          @change="changeStyle({ color: ($event.target as HTMLInputElement).value.toUpperCase() })"
        >
        <code class="text-body-small flex-grow-1">{{ object.style.color }}</code>
      </div>
      <div v-if="object.kind !== 'point'" class="style-row">
        <span class="style-label">Line</span>
        <div class="segmented" role="radiogroup" aria-label="Line style">
          <button
            v-for="option in strokeStyles"
            :key="option.value"
            type="button"
            role="radio"
            class="segmented__option"
            :class="{ 'segmented__option--active': (object.style.strokeStyle ?? 'solid') === option.value }"
            :aria-checked="(object.style.strokeStyle ?? 'solid') === option.value"
            :disabled="disabled"
            @click="changeStyle({ strokeStyle: option.value })"
          >
            {{ option.title }}
          </button>
        </div>
      </div>
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
          <input
            type="color"
            class="color-input"
            :value="(object.style.fillColor ?? object.style.color).toLowerCase()"
            :disabled="disabled"
            aria-label="Fill colour"
            @change="changeStyle({ fillColor: ($event.target as HTMLInputElement).value.toUpperCase() })"
          >
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
    <section v-if="object.geometry.type === 'Route'" class="inspector-block">
      <RouteInspector :geometry="object.geometry" :disabled="disabled" @change="emit('change', { geometry: $event })" />
    </section>

    <section v-if="object.geometry.type !== 'Route'" class="inspector-section">
      <div class="text-label-medium text-uppercase text-medium-emphasis">Position (WGS84)</div>
      <template v-if="object.geometry.type === 'Point' || object.geometry.type === 'Circle' || object.geometry.type === 'Ellipse'">
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
/* Joined options with one outer border, so touching edges are never rounded. */
.segmented {
  display: flex;
  flex: 1 1 auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 8px;
  overflow: hidden;
}
.segmented__option {
  flex: 1 1 0;
  appearance: none;
  border: none;
  border-radius: 0;
  padding: 4px 8px;
  font-size: 0.8125rem;
  color: inherit;
  background: none;
  cursor: pointer;
}
.segmented__option + .segmented__option {
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.24);
}
.segmented__option:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.segmented__option--active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.16);
}
.segmented__option:disabled {
  cursor: default;
  opacity: 0.5;
}
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.color-input {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  overflow: hidden;
}
.color-input:disabled {
  cursor: default;
  opacity: 0.5;
}
.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.color-input::-webkit-color-swatch {
  border: none;
}
.color-input::-moz-color-swatch {
  border: none;
}
</style>
