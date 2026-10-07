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
} from "@/modules/data-packages/data-packages.api";
import MarkerSymbolField from "./MarkerSymbolField.vue";

type ObjectChanges = Partial<{
  name: string;
  description: string | null;
  style: PackageObjectStyle;
  layerId: string;
  geometry: PackageGeometry;
  tak: TakMarker | null;
}>;

const props = defineProps<{ object: PackageObjectDto; layers: PackageLayerDto[]; editable: boolean }>();
const emit = defineEmits<{ change: [changes: ObjectChanges]; duplicate: []; remove: [] }>();

const name = ref("");
const description = ref("");
const position = ref({ longitude: "", latitude: "", altitude: "", radius: "" });

watch(
  () => props.object,
  (object) => {
    name.value = object.name;
    description.value = object.description ?? "";
    if (object.geometry.type === "Point" || object.geometry.type === "Circle") {
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
  return geometry.type === "LineString" ? geometry.coordinates.length : geometry.type === "Polygon" ? (geometry.coordinates[0]?.length ?? 1) - 1 : 1;
});
const unlockedLayers = computed(() => props.layers.filter((layer) => !layer.locked || layer.id === props.object.layerId));

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
  emit("change", { style: { ...props.object.style, ...changes } });
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
  } else {
    emit("change", { geometry: { type: "Point", coordinates } });
  }
}
</script>

<template>
  <div class="pa-3">
    <div class="d-flex align-center mb-3">
      <div class="text-title-small flex-grow-1">Object</div>
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
    <v-alert v-if="locked" type="info" density="compact" class="mb-3">The layer is locked.</v-alert>

    <v-text-field v-model="name" label="Name" density="compact" :disabled="disabled" maxlength="100" @blur="commitText" @keydown.enter="commitText" />
    <v-textarea v-model="description" label="Description" density="compact" rows="2" auto-grow :disabled="disabled" maxlength="2000" @blur="commitText" />
    <v-select
      :model-value="object.layerId"
      :items="unlockedLayers"
      item-title="name"
      item-value="id"
      label="Layer"
      density="compact"
      :disabled="disabled"
      @update:model-value="emit('change', { layerId: $event })"
    />

    <MarkerSymbolField v-if="object.kind === 'point'" :tak="object.tak" :color="object.style.color" :disabled="disabled" @change="emit('change', { tak: $event })" />

    <div class="text-body-small text-medium-emphasis mb-1">Style</div>
    <div class="d-flex align-center ga-3 mb-2">
      <input
        type="color"
        class="color-input"
        :value="object.style.color.toLowerCase()"
        :disabled="disabled"
        aria-label="Colour"
        @change="changeStyle({ color: ($event.target as HTMLInputElement).value.toUpperCase() })"
      >
      <code class="text-body-medium">{{ object.style.color }}</code>
    </div>
    <template v-if="object.kind !== 'point'">
      <v-slider
        :model-value="object.style.strokeWidth"
        label="Width"
        :min="1"
        :max="20"
        :step="1"
        thumb-label
        density="compact"
        hide-details
        :disabled="disabled"
        @end="changeStyle({ strokeWidth: $event })"
      />
    </template>
    <v-slider
      v-if="object.kind === 'polygon' || object.kind === 'circle'"
      :model-value="object.style.fillOpacity"
      label="Fill"
      :min="0"
      :max="1"
      :step="0.05"
      thumb-label
      density="compact"
      hide-details
      :disabled="disabled"
      @end="changeStyle({ fillOpacity: $event })"
    />

    <div class="text-body-small text-medium-emphasis mt-4 mb-1">Position (WGS84)</div>
    <template v-if="object.geometry.type === 'Point' || object.geometry.type === 'Circle'">
      <div class="d-flex ga-2">
        <v-text-field v-model="position.latitude" label="Latitude" density="compact" :disabled="disabled" @blur="commitPosition" @keydown.enter="commitPosition" />
        <v-text-field v-model="position.longitude" label="Longitude" density="compact" :disabled="disabled" @blur="commitPosition" @keydown.enter="commitPosition" />
      </div>
      <v-text-field
        v-model="position.altitude"
        label="Altitude (m HAE, optional)"
        density="compact"
        :disabled="disabled"
        @blur="commitPosition"
        @keydown.enter="commitPosition"
      >
        <template #append-inner>
          <InfoHint label="About altitude" text="Leave empty when unknown" />
        </template>
      </v-text-field>
      <v-text-field
        v-if="object.geometry.type === 'Circle'"
        v-model="position.radius"
        label="Radius (m)"
        density="compact"
        class="mt-2"
        :disabled="disabled"
        @blur="commitPosition"
        @keydown.enter="commitPosition"
      />
    </template>
    <p v-else class="text-body-medium my-0">{{ vertexCount }} vertices. Drag vertices on the map to change the shape.</p>
  </div>
</template>

<style scoped>
.color-input {
  width: 40px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
}
</style>
