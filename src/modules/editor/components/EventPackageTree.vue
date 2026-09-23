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
import { ref } from "vue";
import type { PackageLayerDto } from "@/modules/data-packages/data-packages.api";
import { PACKAGE_DRAG_TYPE } from "@/modules/data-packages/package-order";
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
  /** A package was dropped onto another one; the parent saves the new order. */
  reorderPackage: [packageId: string, targetPackageId: string];
}>();

const dropTarget = ref<string | null>(null);

function startPackageDrag(event: DragEvent, packageId: string): void {
  if (props.editable && event.dataTransfer !== null) {
    event.dataTransfer.setData(PACKAGE_DRAG_TYPE, packageId);
    event.dataTransfer.effectAllowed = "move";
  }
}

function allowPackageDrop(event: DragEvent, packageId: string): void {
  if (props.editable && (event.dataTransfer?.types ?? []).includes(PACKAGE_DRAG_TYPE)) {
    event.preventDefault();
    dropTarget.value = packageId;
  }
}

function dropPackage(event: DragEvent, packageId: string): void {
  dropTarget.value = null;
  const dragged = event.dataTransfer?.getData(PACKAGE_DRAG_TYPE);
  if (dragged && dragged !== packageId) {
    emit("reorderPackage", dragged, packageId);
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
    <div class="text-subtitle-2 px-2 pt-1 pb-2">Data packages</div>
    <div
      v-for="branch in branches"
      :key="branch.dataPackage.id"
      class="mb-2"
      :class="{ 'package-drop-target': dropTarget === branch.dataPackage.id }"
      @dragover="allowPackageDrop($event, branch.dataPackage.id)"
      @dragleave="dropTarget = null"
      @drop="dropPackage($event, branch.dataPackage.id)"
    >
      <v-list-item
        :draggable="editable"
        :active="branch.dataPackage.id === activePackageId"
        color="primary"
        rounded="lg"
        density="compact"
        prepend-gap="8"
        class="package-row ps-1"
        @dragstart="startPackageDrag($event, branch.dataPackage.id)"
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
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.package-drop-target > .package-row {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.package-row {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
