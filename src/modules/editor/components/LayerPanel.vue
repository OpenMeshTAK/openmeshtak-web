<script setup lang="ts">
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiChevronDown,
  mdiChevronRight,
  mdiCircleOutline,
  mdiContentCopy,
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
  mdiRectangleOutline,
  mdiEllipseOutline,
  mdiRoutes,
} from "@mdi/js";
import { ref, watch } from "vue";
import { VueDraggable, type SortableEvent } from "vue-draggable-plus";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { readCollapsedLayers, storeCollapsedLayers } from "../collapsed-layers";
import type {
  ContentChanges,
  PackageContentDto,
  PackageLayerDto,
  PackageObjectDto,
} from "@/modules/data-packages/data-packages.api";
import LayerContentRow from "./LayerContentRow.vue";

export type LayerChanges = Partial<Pick<PackageLayerDto, "name" | "visible" | "locked">>;
export type LayerExportFormat = "atak" | "geojson" | "kml";

const props = defineProps<{
  /** Used to remember collapsed layers per data package in this browser. */
  packageId: string;
  layers: PackageLayerDto[];
  objects: PackageObjectDto[];
  activeLayerId: string | null;
  selectedId: string | null;
  editable: boolean;
  canCopy: boolean;
  /** Removes the full-height inner scroller when several panels live in the event tree. */
  embedded?: boolean;
  /** Offline maps and rubber sheets of this package's draft. */
  contents?: PackageContentDto[];
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
  copyLayer: [layer: PackageLayerDto];
  remove: [layer: PackageLayerDto];
  changeContent: [contentId: string, changes: ContentChanges];
  removeContent: [contentId: string];
  zoomToContent: [contentId: string];
}>();

const KIND_ICONS = { point: mdiMapMarker, line: mdiVectorPolyline, polygon: mdiShapePolygonPlus, circle: mdiCircleOutline, rectangle: mdiRectangleOutline, ellipse: mdiEllipseOutline, route: mdiRoutes } as const;
/**
 * Local copies for vue-draggable-plus (SortableJS), which reorders its model during a drag. The
 * editor stays authoritative: drops are reported as events and the copies follow the props again.
 * The top of the list is drawn last, matching how map layers stack.
 */
const displayed = ref<PackageLayerDto[]>([]);
const objectsByLayer = ref<Record<string, PackageObjectDto[]>>({});
const contentsByLayer = ref<Record<string, PackageContentDto[]>>({});

watch(
  () => [props.layers, props.objects, props.contents] as const,
  ([layers, objects, contents]) => {
    displayed.value = [...layers].reverse();
    objectsByLayer.value = Object.fromEntries(
      layers.map((layer) => [layer.id, objects.filter((object) => object.layerId === layer.id)]),
    );
    contentsByLayer.value = Object.fromEntries(
      layers.map((layer) => [layer.id, (contents ?? []).filter((content) => content.layerId === layer.id)]),
    );
  },
  { immediate: true },
);

function layerSummary(layerId: string): string {
  const objects = objectsOf(layerId).length;
  const maps = contentsByLayer.value[layerId]?.length ?? 0;
  const objectText = `${String(objects)} ${objects === 1 ? "object" : "objects"}`;
  return maps === 0 ? objectText : `${objectText} · ${String(maps)} ${maps === 1 ? "map" : "maps"}`;
}

function contentDropped(event: SortableEvent, layerId: string): void {
  const contentId = (event.item as HTMLElement).querySelector<HTMLElement>("[data-content-id]")?.dataset.contentId;
  if (contentId !== undefined) {
    emit("changeContent", contentId, { layerId });
  }
}

function contentGroup(layer: PackageLayerDto) {
  return { name: `contents-${props.packageId}`, pull: !layer.locked, put: !layer.locked };
}
const collapsed = ref(readCollapsedLayers(props.packageId));
const renaming = ref<string | null>(null);
const newName = ref("");
const removing = ref<PackageLayerDto | null>(null);
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

/** Sortable reports positions in the list before the drop; the dragged layer takes the target's slot. */
function layerDropped(event: SortableEvent): void {
  const before = [...props.layers].reverse();
  const dragged = before[event.oldIndex ?? -1];
  const target = before[event.newIndex ?? -1];
  if (dragged !== undefined && target !== undefined && dragged.id !== target.id) {
    emit("reorder", dragged.id, target.id);
  } else {
    displayed.value = before;
  }
}

function objectDropped(event: SortableEvent, layerId: string): void {
  const objectId = (event.item as HTMLElement).dataset.objectId;
  if (objectId !== undefined) {
    emit("moveObject", objectId, layerId);
  }
}

/** Objects move between the layers of one package; locked layers neither give nor take. */
function objectGroup(layer: PackageLayerDto) {
  return { name: `objects-${props.packageId}`, pull: !layer.locked, put: !layer.locked };
}
</script>

<template>
  <div class="d-flex flex-column" :class="{ 'h-100': !embedded }">
    <div class="d-flex align-center px-3 pt-2 pb-1">
      <div class="text-title-small flex-grow-1">Layers</div>
      <v-btn v-if="editable" size="small" variant="tonal" :prepend-icon="mdiPlus" @click="emit('add')">Layer</v-btn>
    </div>

    <div class="flex-grow-1 pb-3" :class="{ 'overflow-y-auto': !embedded }">
      <VueDraggable
        v-model="displayed"
        :animation="180"
        handle=".layer-handle"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :group="`layers-${packageId}`"
        :disabled="!editable || renaming !== null"
        @end="layerDropped"
      >
        <div
          v-for="(layer, index) in displayed"
          :key="layer.id"
          class="mb-1 layer-block"
        >
          <v-list-item
            :active="layer.id === activeLayerId"
            color="primary"
            rounded="lg"
            class="mx-1 ps-1"
            :class="{ 'layer-handle': editable }"
            prepend-gap="8"
            density="compact"
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
            <v-list-item-subtitle>{{ layerSummary(layer.id) }}</v-list-item-subtitle>
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
                  <v-list-item title="Export as KML" :prepend-icon="mdiDownload" @click="emit('exportLayer', layer, 'kml')" />
                  <v-list-item
                    title="Create data package from layer…"
                    :prepend-icon="mdiContentCopy"
                    :disabled="!canCopy"
                    @click="emit('copyLayer', layer)"
                  />
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

          <VueDraggable
            :model-value="objectsByLayer[layer.id] ?? []"
            :animation="180"
            :sort="false"
            :group="objectGroup(layer)"
            :disabled="!editable"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            class="object-list ml-6 mr-1"
            :class="{ 'object-list--collapsed': collapsed.has(layer.id) }"
            @update:model-value="objectsByLayer[layer.id] = $event"
            @add="objectDropped($event, layer.id)"
          >
            <template v-if="!collapsed.has(layer.id)">
              <v-list-item
                v-for="object in objectsByLayer[layer.id] ?? []"
                :key="object.id"
                :data-object-id="object.id"
                :active="object.id === selectedId"
                :prepend-icon="KIND_ICONS[object.kind]"
                prepend-gap="10"
                class="ps-2"
                :title="object.name"
                rounded="lg"
                density="compact"
                :class="{ 'text-disabled': !layer.visible }"
                @click="emit('select', object.id)"
              />
            </template>
          </VueDraggable>
          <VueDraggable
            v-if="!collapsed.has(layer.id) && (contentsByLayer[layer.id]?.length ?? 0) > 0"
            :model-value="contentsByLayer[layer.id] ?? []"
            :animation="180"
            :sort="false"
            :group="contentGroup(layer)"
            :disabled="!editable"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            class="ml-6 mr-1"
            @update:model-value="contentsByLayer[layer.id] = $event"
            @add="contentDropped($event, layer.id)"
          >
            <LayerContentRow
              v-for="content in contentsByLayer[layer.id] ?? []"
              :key="content.id"
              :content="content"
              :editable="editable"
              :locked="layer.locked"
              :layer-visible="layer.visible"
              @change="emit('changeContent', content.id, $event)"
              @remove="emit('removeContent', content.id)"
              @zoom="emit('zoomToContent', content.id)"
            />
          </VueDraggable>
        </div>
      </VueDraggable>
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
}
.layer-handle {
  cursor: grab;
}
/* Collapsed and empty layers keep a small drop zone so objects can still be moved into them. */
.object-list {
  min-height: 6px;
}
.object-list--collapsed {
  min-height: 6px;
}
</style>
