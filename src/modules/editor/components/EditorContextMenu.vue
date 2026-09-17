<script setup lang="ts">
import {
  mdiContentCopy,
  mdiContentDuplicate,
  mdiContentPaste,
  mdiLayersOutline,
  mdiMapMarkerPlusOutline,
  mdiTrashCanOutline,
} from "@mdi/js";
import { computed } from "vue";
import type { PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";

export interface ContextTarget {
  objectId: string | null;
  clientX: number;
  clientY: number;
  /** WGS84 position under the cursor. */
  position: number[];
}

const props = defineProps<{
  target: ContextTarget | null;
  object: PackageObjectDto | null;
  layers: PackageLayerDto[];
  editable: boolean;
  canPaste: boolean;
}>();
const emit = defineEmits<{
  close: [];
  copy: [];
  duplicate: [];
  remove: [];
  moveTo: [layerId: string];
  paste: [position: number[]];
  addMarker: [position: number[]];
}>();

const open = computed({
  get: () => props.target !== null,
  set: (value: boolean) => {
    if (!value) {
      emit("close");
    }
  },
});

const locked = computed(() => props.layers.find(({ id }) => id === props.object?.layerId)?.locked === true);
const otherLayers = computed(() =>
  props.layers.filter((layer) => layer.id !== props.object?.layerId && !layer.locked).reverse(),
);

/** Runs the action and closes the menu, so every item behaves the same way. */
function choose(action: () => void): void {
  action();
  emit("close");
}
</script>

<template>
  <v-menu
    v-model="open"
    :target="target ? [target.clientX, target.clientY] : undefined"
    location="bottom start"
    :close-on-content-click="false"
  >
    <v-list v-if="target" density="compact" min-width="220">
      <template v-if="object">
        <v-list-subheader class="text-truncate">{{ object.name }}</v-list-subheader>
        <v-list-item title="Copy" subtitle="Ctrl+C" :prepend-icon="mdiContentCopy" @click="choose(() => emit('copy'))" />
        <template v-if="editable">
          <v-list-item title="Duplicate" :prepend-icon="mdiContentDuplicate" :disabled="locked" @click="choose(() => emit('duplicate'))" />
          <v-menu location="end" open-on-hover :disabled="locked || otherLayers.length === 0">
            <template #activator="{ props: submenu }">
              <v-list-item v-bind="submenu" title="Move to layer" :prepend-icon="mdiLayersOutline" :disabled="locked || otherLayers.length === 0" />
            </template>
            <v-list density="compact">
              <v-list-item v-for="layer in otherLayers" :key="layer.id" :title="layer.name" @click="choose(() => emit('moveTo', layer.id))" />
            </v-list>
          </v-menu>
          <v-divider />
          <v-list-item
            title="Delete"
            subtitle="Del"
            base-color="error"
            :prepend-icon="mdiTrashCanOutline"
            :disabled="locked"
            @click="choose(() => emit('remove'))"
          />
        </template>
      </template>
      <template v-else-if="editable">
        <v-list-item
          title="Paste here"
          subtitle="Ctrl+V"
          :prepend-icon="mdiContentPaste"
          :disabled="!canPaste"
          @click="choose(() => emit('paste', target!.position))"
        />
        <v-list-item title="Add marker here" :prepend-icon="mdiMapMarkerPlusOutline" @click="choose(() => emit('addMarker', target!.position))" />
      </template>
      <v-list-item v-else title="Nothing to do here" disabled />
    </v-list>
  </v-menu>
</template>
