<script setup lang="ts">
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiDotsVertical,
  mdiDownload,
  mdiFolderOutline,
  mdiOpenInNew,
  mdiPublish,
} from "@mdi/js";
import { ref, watch } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import type { ContentChanges, PackageLayerDto } from "@/modules/data-packages/data-packages.api";
import type { EventPackageBranch } from "../event-editor.types";
import LayerPanel, { type LayerChanges, type LayerExportFormat } from "./LayerPanel.vue";

const props = defineProps<{
  branches: EventPackageBranch[];
  activePackageId: string | null;
  activeLayerId: string | null;
  selectedId: string | null;
  editable: boolean;
  canPublish: boolean;
}>();
const emit = defineEmits<{
  activatePackage: [branch: EventPackageBranch];
  activateLayer: [branch: EventPackageBranch, layerId: string];
  select: [objectId: string];
  openPackage: [packageId: string];
  publishPackage: [branch: EventPackageBranch];
  exportPackage: [branch: EventPackageBranch, format: LayerExportFormat];
  addLayer: [branch: EventPackageBranch];
  changeLayer: [branch: EventPackageBranch, layer: PackageLayerDto, changes: LayerChanges];
  moveLayer: [branch: EventPackageBranch, layer: PackageLayerDto, direction: -1 | 1];
  reorderLayer: [branch: EventPackageBranch, layerId: string, targetLayerId: string];
  moveObject: [branch: EventPackageBranch, objectId: string, layerId: string];
  importInto: [branch: EventPackageBranch, layer: PackageLayerDto];
  exportLayer: [branch: EventPackageBranch, layer: PackageLayerDto, format: LayerExportFormat];
  copyLayer: [branch: EventPackageBranch, layer: PackageLayerDto];
  removeLayer: [branch: EventPackageBranch, layer: PackageLayerDto];
  changeContent: [branch: EventPackageBranch, contentId: string, changes: ContentChanges];
  removeContent: [branch: EventPackageBranch, contentId: string];
  zoomToContent: [contentId: string];
  /** Packages were reordered by drag and drop; IDs top first. */
  reorderPackages: [topFirstIds: string[]];
}>();

/** Local copy for vue-draggable-plus; the parent saves a drop and passes the new order back. */
const ordered = ref<EventPackageBranch[]>([]);
watch(
  () => props.branches,
  (branches) => {
    ordered.value = [...branches];
  },
  { immediate: true },
);

function packageDropped(): void {
  const ids = ordered.value.map(({ dataPackage }) => dataPackage.id);
  if (ids.some((id, index) => id !== props.branches[index]?.dataPackage.id)) {
    emit("reorderPackages", ids);
  }
}

const collapsedPackages = ref(new Set<string>());

function togglePackage(packageId: string): void {
  const next = new Set(collapsedPackages.value);
  if (!next.delete(packageId)) {
    next.add(packageId);
  }
  collapsedPackages.value = next;
}
</script>

<template>
  <div class="event-tree h-100 overflow-y-auto pa-2">
    <div class="text-title-small px-2 pt-1 pb-2">Data packages</div>
    <VueDraggable
      v-model="ordered"
      :animation="180"
      handle=".package-handle"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
      :disabled="!editable"
      @end="packageDropped"
    >
      <div
        v-for="branch in ordered"
        :key="branch.dataPackage.id"
        class="mb-2"
      >
        <v-list-item
          :active="branch.dataPackage.id === activePackageId"
          color="primary"
          rounded="lg"
          density="compact"
          prepend-gap="8"
          class="package-row ps-1"
          :class="{ 'package-handle': editable }"
          @click="emit('activatePackage', branch)"
        >
          <template #prepend>
            <v-btn
              :icon="collapsedPackages.has(branch.dataPackage.id) ? mdiChevronRight : mdiChevronDown"
              size="x-small"
              variant="text"
              :aria-label="collapsedPackages.has(branch.dataPackage.id) ? `Expand ${branch.dataPackage.name}` : `Collapse ${branch.dataPackage.name}`"
              @click.stop="togglePackage(branch.dataPackage.id)"
            />
            <v-icon :icon="mdiFolderOutline" size="20" />
          </template>
          <v-list-item-title class="font-weight-bold">{{ branch.dataPackage.name }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ branch.layers.length }} {{ branch.layers.length === 1 ? "layer" : "layers" }} ·
            {{ branch.objects.length }} {{ branch.objects.length === 1 ? "item" : "items" }} ·
            {{ branch.dataPackage.latestRevision ? `revision ${branch.dataPackage.latestRevision}` : "not published" }}
          </v-list-item-subtitle>
          <template #append>
            <v-menu>
              <template #activator="{ props: menu }">
                <v-btn
                  v-bind="menu"
                  :icon="mdiDotsVertical"
                  size="x-small"
                  variant="text"
                  :aria-label="`Actions for ${branch.dataPackage.name}`"
                  @click.stop
                />
              </template>
              <v-list density="compact" min-width="230">
                <v-list-item title="Open only this data package" :prepend-icon="mdiOpenInNew" @click="emit('openPackage', branch.dataPackage.id)" />
                <v-list-item
                  title="Publish data package"
                  :prepend-icon="mdiPublish"
                  :disabled="!canPublish"
                  @click="emit('publishPackage', branch)"
                />
                <v-divider />
                <v-list-item
                  title="Export as ATAK package"
                  :subtitle="branch.dataPackage.latestRevision === null ? 'Publish first' : ''"
                  :prepend-icon="mdiDownload"
                  :disabled="branch.dataPackage.latestRevision === null"
                  @click="emit('exportPackage', branch, 'atak')"
                />
                <v-list-item title="Export draft as GeoJSON" :prepend-icon="mdiDownload" @click="emit('exportPackage', branch, 'geojson')" />
                <v-list-item title="Export draft as KML" :prepend-icon="mdiDownload" @click="emit('exportPackage', branch, 'kml')" />
              </v-list>
            </v-menu>
          </template>
        </v-list-item>

        <div v-if="!collapsedPackages.has(branch.dataPackage.id)" class="ml-4">
          <LayerPanel
            embedded
            :package-id="branch.dataPackage.id"
            :layers="branch.layers"
            :objects="branch.objects"
            :contents="branch.contents"
            :active-layer-id="branch.dataPackage.id === activePackageId ? activeLayerId : null"
            :selected-id="selectedId"
            :editable="editable"
            :can-copy="editable && branch.dataPackage.latestRevision !== null"
            @activate="emit('activateLayer', branch, $event)"
            @select="emit('select', $event)"
            @add="emit('addLayer', branch)"
            @change="(layer, changes) => emit('changeLayer', branch, layer, changes)"
            @move="(layer, direction) => emit('moveLayer', branch, layer, direction)"
            @reorder="(layerId, targetLayerId) => emit('reorderLayer', branch, layerId, targetLayerId)"
            @move-object="(objectId, layerId) => emit('moveObject', branch, objectId, layerId)"
            @import-into="(layer) => emit('importInto', branch, layer)"
            @export-layer="(layer, format) => emit('exportLayer', branch, layer, format)"
            @copy-layer="(layer) => emit('copyLayer', branch, layer)"
            @remove="(layer) => emit('removeLayer', branch, layer)"
            @change-content="(contentId, changes) => emit('changeContent', branch, contentId, changes)"
            @remove-content="(contentId) => emit('removeContent', branch, contentId)"
            @zoom-to-content="emit('zoomToContent', $event)"
          />
        </div>
      </div>
    </VueDraggable>
  </div>
</template>

<style scoped>
.package-handle {
  cursor: grab;
}
.package-row {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
