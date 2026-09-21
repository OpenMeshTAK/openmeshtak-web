<script setup lang="ts">
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiCircleOutline,
  mdiContentCopy,
  mdiEye,
  mdiEyeOff,
  mdiFolderOutline,
  mdiMapMarker,
  mdiOpenInNew,
  mdiShapePolygonPlus,
  mdiVectorPolyline,
} from "@mdi/js";
import { ref } from "vue";
import type { PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import type { EventPackageBranch } from "../event-editor.types";

defineProps<{
  branches: EventPackageBranch[];
  selectedId: string | null;
  canCopy: boolean;
}>();
const emit = defineEmits<{
  select: [objectId: string];
  openPackage: [packageId: string];
  toggleLayer: [layer: PackageLayerDto];
  copyLayer: [branch: EventPackageBranch, layer: PackageLayerDto];
}>();

const KIND_ICONS = {
  point: mdiMapMarker,
  line: mdiVectorPolyline,
  polygon: mdiShapePolygonPlus,
  circle: mdiCircleOutline,
} as const;
const collapsedPackages = ref(new Set<string>());
const collapsedLayers = ref(new Set<string>());

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
}

function objectsOf(branch: EventPackageBranch, layerId: string): PackageObjectDto[] {
  return branch.objects.filter((object) => object.layerId === layerId);
}
</script>

<template>
  <div class="event-tree h-100 overflow-y-auto pa-2">
    <div class="text-subtitle-2 px-2 pt-1 pb-2">Data packages</div>
    <div v-for="branch in branches" :key="branch.dataPackage.id" class="mb-2">
      <v-list-item rounded="lg" density="compact" class="package-row">
        <template #prepend>
          <v-btn
            :icon="collapsedPackages.has(branch.dataPackage.id) ? mdiChevronRight : mdiChevronDown"
            size="x-small"
            variant="text"
            :aria-label="collapsedPackages.has(branch.dataPackage.id) ? `Expand ${branch.dataPackage.name}` : `Collapse ${branch.dataPackage.name}`"
            @click="collapsedPackages = toggle(collapsedPackages, branch.dataPackage.id)"
          />
          <v-icon :icon="mdiFolderOutline" size="20" class="ml-1" />
        </template>
        <v-list-item-title class="font-weight-bold">{{ branch.dataPackage.name }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ branch.layers.length }} {{ branch.layers.length === 1 ? "layer" : "layers" }} ·
          {{ branch.objects.length }} {{ branch.objects.length === 1 ? "item" : "items" }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            :icon="mdiOpenInNew"
            size="x-small"
            variant="text"
            :aria-label="`Open ${branch.dataPackage.name}`"
            @click="emit('openPackage', branch.dataPackage.id)"
          />
        </template>
      </v-list-item>

      <div v-if="!collapsedPackages.has(branch.dataPackage.id)" class="ml-4">
        <div v-for="layer in branch.layers" :key="layer.id" class="layer-row">
          <v-list-item rounded="lg" density="compact" class="ps-1">
            <template #prepend>
              <v-btn
                :icon="collapsedLayers.has(layer.id) ? mdiChevronRight : mdiChevronDown"
                size="x-small"
                variant="text"
                :aria-label="collapsedLayers.has(layer.id) ? `Expand ${layer.name}` : `Collapse ${layer.name}`"
                @click="collapsedLayers = toggle(collapsedLayers, layer.id)"
              />
            </template>
            <v-list-item-title>{{ layer.name }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ objectsOf(branch, layer.id).length }} {{ objectsOf(branch, layer.id).length === 1 ? "item" : "items" }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                :icon="layer.visible ? mdiEye : mdiEyeOff"
                size="x-small"
                variant="text"
                :aria-label="layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`"
                @click="emit('toggleLayer', layer)"
              />
              <v-menu>
                <template #activator="{ props: menu }">
                  <v-btn v-bind="menu" :icon="mdiContentCopy" size="x-small" variant="text" :aria-label="`Actions for ${layer.name}`" />
                </template>
                <v-list density="compact">
                  <v-list-item
                    title="Create data package from layer…"
                    :subtitle="branch.dataPackage.latestRevision === null ? 'Publish this data package first' : ''"
                    :prepend-icon="mdiContentCopy"
                    :disabled="!canCopy || branch.dataPackage.latestRevision === null"
                    @click="emit('copyLayer', branch, layer)"
                  />
                </v-list>
              </v-menu>
            </template>
          </v-list-item>

          <v-list v-if="!collapsedLayers.has(layer.id)" density="compact" class="py-0 ml-7" bg-color="transparent">
            <v-list-item
              v-for="object in objectsOf(branch, layer.id)"
              :key="object.id"
              :active="object.id === selectedId"
              :prepend-icon="KIND_ICONS[object.kind]"
              :title="object.name"
              rounded="lg"
              density="compact"
              :class="{ 'text-disabled': !layer.visible }"
              @click="emit('select', object.id)"
            />
          </v-list>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.package-row {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.layer-row + .layer-row {
  margin-top: 2px;
}
</style>
