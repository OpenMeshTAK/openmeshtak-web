<script setup lang="ts">
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiChevronDown,
  mdiChevronRight,
  mdiCircleOutline,
  mdiDotsVertical,
  mdiDownload,
  mdiEye,
  mdiEyeOff,
  mdiLock,
  mdiLockOpenVariant,
  mdiMapMarker,
  mdiPlus,
  mdiShapePolygonPlus,
  mdiUpload,
  mdiVectorPolyline,
} from "@mdi/js";
import { computed, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { readCollapsedLayers, storeCollapsedLayers } from "../collapsed-layers";
import type { PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";

type LayerChanges = Partial<Pick<PackageLayerDto, "name" | "visible" | "locked">>;
export type LayerExportFormat = "atak" | "geojson";

const props = defineProps<{
  /** Used to remember collapsed layers per data package in this browser. */
  packageId: string;
  layers: PackageLayerDto[];
  objects: PackageObjectDto[];
  activeLayerId: string | null;
  selectedId: string | null;
  editable: boolean;
}>();
const emit = defineEmits<{
  activate: [layerId: string];
  select: [objectId: string];
  add: [];
  change: [layer: PackageLayerDto, changes: LayerChanges];
  move: [layer: PackageLayerDto, direction: -1 | 1];
  reorder: [layerId: string, targetLayerId: string];
  moveObject: [objectId: string, layerId: string];
  importInto: [layer: PackageLayerDto];
  exportLayer: [layer: PackageLayerDto, format: LayerExportFormat];
  remove: [layer: PackageLayerDto];
}>();

const KIND_ICONS = { point: mdiMapMarker, line: mdiVectorPolyline, polygon: mdiShapePolygonPlus, circle: mdiCircleOutline } as const;
const LAYER_DRAG = "application/x-openmeshtak-layer";
const OBJECT_DRAG = "application/x-openmeshtak-object";

/** The top of the list is drawn last, matching how map layers stack. */
const displayed = computed(() => [...props.layers].reverse());
const collapsed = ref(readCollapsedLayers(props.packageId));
const renaming = ref<string | null>(null);
const newName = ref("");
const removing = ref<PackageLayerDto | null>(null);
const dropTarget = ref<string | null>(null);

function objectsOf(layerId: string): PackageObjectDto[] {
  return props.objects.filter((object) => object.layerId === layerId);
}

function toggleCollapsed(layerId: string): void {
  const next = new Set(collapsed.value);
  if (!next.delete(layerId)) {
    next.add(layerId);
  }
  collapsed.value = next;
  storeCollapsedLayers(props.packageId, next);
}

function startRename(layer: PackageLayerDto): void {
  if (props.editable) {
    renaming.value = layer.id;
    newName.value = layer.name;
  }
}

function finishRename(layer: PackageLayerDto): void {
  const name = newName.value.trim();
  renaming.value = null;
  if (name !== "" && name !== layer.name) {
    emit("change", layer, { name });
  }
}

function confirmRemove(): void {
  if (removing.value !== null) {
    emit("remove", removing.value);
  }
  removing.value = null;
}

// ---- Drag and drop: layers reorder, objects move to another layer ------------------------------

function startDrag(event: DragEvent, type: string, id: string): void {
  if (!props.editable || event.dataTransfer === null) {
    return;
  }
  event.dataTransfer.setData(type, id);
  event.dataTransfer.effectAllowed = "move";
}

function allowDrop(event: DragEvent, layerId: string): void {
  const types = event.dataTransfer?.types ?? [];
  if (props.editable && (types.includes(LAYER_DRAG) || types.includes(OBJECT_DRAG))) {
    event.preventDefault();
    dropTarget.value = layerId;
  }
}

function drop(event: DragEvent, layerId: string): void {
  dropTarget.value = null;
  const draggedLayer = event.dataTransfer?.getData(LAYER_DRAG);
  const draggedObject = event.dataTransfer?.getData(OBJECT_DRAG);
  if (draggedLayer && draggedLayer !== layerId) {
    emit("reorder", draggedLayer, layerId);
  } else if (draggedObject) {
    emit("moveObject", draggedObject, layerId);
  }
}
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center px-3 pt-3 pb-2">
      <div class="text-subtitle-2 flex-grow-1">Layers</div>
      <v-btn v-if="editable" size="small" variant="tonal" :prepend-icon="mdiPlus" @click="emit('add')">Layer</v-btn>
    </div>

    <div class="flex-grow-1 overflow-y-auto pb-3">
      <div
        v-for="(layer, index) in displayed"
        :key="layer.id"
        class="mb-1 layer-block"
        :class="{ 'layer-block--drop': dropTarget === layer.id }"
        @dragover="allowDrop($event, layer.id)"
        @dragleave="dropTarget = null"
        @drop="drop($event, layer.id)"
      >
        <v-list-item
          :active="layer.id === activeLayerId"
          color="primary"
          rounded="lg"
          class="mx-2"
          density="compact"
          :draggable="editable && renaming !== layer.id"
          @dragstart="startDrag($event, LAYER_DRAG, layer.id)"
          @click="emit('activate', layer.id)"
        >
          <template #prepend>
            <v-btn
              :icon="collapsed.has(layer.id) ? mdiChevronRight : mdiChevronDown"
              size="x-small"
              variant="text"
              :aria-label="collapsed.has(layer.id) ? `Expand ${layer.name}` : `Collapse ${layer.name}`"
              :aria-expanded="!collapsed.has(layer.id)"
              @click.stop="toggleCollapsed(layer.id)"
            />
          </template>
          <v-text-field
            v-if="renaming === layer.id"
            v-model="newName"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
            maxlength="100"
            aria-label="Layer name"
            @keydown.enter="finishRename(layer)"
            @keydown.esc="renaming = null"
            @blur="finishRename(layer)"
            @click.stop
          />
          <v-list-item-title v-else class="font-weight-medium" @dblclick.stop="startRename(layer)">{{ layer.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ objectsOf(layer.id).length }} objects</v-list-item-subtitle>
          <template #append>
            <v-btn
              :icon="layer.visible ? mdiEye : mdiEyeOff"
              size="x-small"
              variant="text"
              :aria-label="layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`"
              @click.stop="emit('change', layer, { visible: !layer.visible })"
            />
            <v-btn
              :icon="layer.locked ? mdiLock : mdiLockOpenVariant"
              size="x-small"
              variant="text"
              :disabled="!editable"
              :aria-label="layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`"
              @click.stop="emit('change', layer, { locked: !layer.locked })"
            />
            <v-menu>
              <template #activator="{ props: menu }">
                <v-btn v-bind="menu" :icon="mdiDotsVertical" size="x-small" variant="text" :aria-label="`More for ${layer.name}`" @click.stop />
              </template>
              <v-list density="compact">
                <v-list-item v-if="editable" title="Rename" @click="startRename(layer)" />
                <v-list-item
                  v-if="editable"
                  title="Import into this layer…"
                  :prepend-icon="mdiUpload"
                  :disabled="layer.locked"
                  @click="emit('importInto', layer)"
                />
                <v-list-item title="Export as ATAK package" :prepend-icon="mdiDownload" @click="emit('exportLayer', layer, 'atak')" />
                <v-list-item title="Export as GeoJSON" :prepend-icon="mdiDownload" @click="emit('exportLayer', layer, 'geojson')" />
                <template v-if="editable">
                  <v-divider />
                  <v-list-item title="Move up" :prepend-icon="mdiArrowUp" :disabled="index === 0" @click="emit('move', layer, 1)" />
                  <v-list-item
                    title="Move down"
                    :prepend-icon="mdiArrowDown"
                    :disabled="index === layers.length - 1"
                    @click="emit('move', layer, -1)"
                  />
                  <v-list-item title="Delete layer…" base-color="error" :disabled="layers.length === 1" @click="removing = layer" />
                </template>
              </v-list>
            </v-menu>
          </template>
        </v-list-item>

        <v-list v-if="!collapsed.has(layer.id)" density="compact" class="py-0 ml-8 mr-2" bg-color="transparent">
          <v-list-item
            v-for="object in objectsOf(layer.id)"
            :key="object.id"
            :active="object.id === selectedId"
            :prepend-icon="KIND_ICONS[object.kind]"
            :title="object.name"
            rounded="lg"
            density="compact"
            :draggable="editable && !layer.locked"
            :class="{ 'text-disabled': !layer.visible }"
            @dragstart="startDrag($event, OBJECT_DRAG, object.id)"
            @click="emit('select', object.id)"
          />
        </v-list>
      </div>
    </div>

    <ConfirmDialog
      :model-value="removing !== null"
      title="Delete this layer?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="removing = null"
      @confirm="confirmRemove"
    >
      {{ removing?.name }} and its {{ removing ? objectsOf(removing.id).length : 0 }} objects are removed from the
      draft. Published revisions keep them.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.layer-block {
  border-radius: 8px;
  outline: 2px dashed transparent;
  outline-offset: -2px;
}
.layer-block--drop {
  outline-color: rgb(var(--v-theme-primary));
}
</style>
