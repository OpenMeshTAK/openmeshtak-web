<script setup lang="ts">
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiDotsVertical,
  mdiEye,
  mdiEyeOff,
  mdiLock,
  mdiLockOpenVariant,
  mdiMapMarker,
  mdiPlus,
  mdiShapePolygonPlus,
  mdiVectorPolyline,
} from "@mdi/js";
import { ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import type { MissionLayerDto, MissionObjectDto } from "@/modules/missions/missions.api";

type LayerChanges = Partial<Pick<MissionLayerDto, "name" | "visible" | "locked">>;

const props = defineProps<{
  layers: MissionLayerDto[];
  objects: MissionObjectDto[];
  activeLayerId: string | null;
  selectedId: string | null;
  editable: boolean;
}>();
const emit = defineEmits<{
  activate: [layerId: string];
  select: [objectId: string];
  add: [];
  change: [layer: MissionLayerDto, changes: LayerChanges];
  move: [layer: MissionLayerDto, direction: -1 | 1];
  remove: [layer: MissionLayerDto];
}>();

const KIND_ICONS = { point: mdiMapMarker, line: mdiVectorPolyline, polygon: mdiShapePolygonPlus } as const;

const renaming = ref<string | null>(null);
const newName = ref("");
const removing = ref<MissionLayerDto | null>(null);

function objectsOf(layerId: string): MissionObjectDto[] {
  return props.objects.filter((object) => object.layerId === layerId);
}

function startRename(layer: MissionLayerDto): void {
  renaming.value = layer.id;
  newName.value = layer.name;
}

function finishRename(layer: MissionLayerDto): void {
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
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center px-3 pt-3 pb-2">
      <div class="text-subtitle-2 flex-grow-1">Layers</div>
      <v-btn v-if="editable" size="small" variant="tonal" :prepend-icon="mdiPlus" @click="emit('add')">Layer</v-btn>
    </div>
    <p class="text-caption text-medium-emphasis px-3 mb-2">New objects go into the highlighted layer.</p>

    <div class="flex-grow-1 overflow-y-auto pb-3">
      <!-- Top of the list is drawn last, matching how map layers stack. -->
      <div v-for="(layer, index) in [...layers].reverse()" :key="layer.id" class="mb-1">
        <v-list-item
          :active="layer.id === activeLayerId"
          color="primary"
          rounded="lg"
          class="mx-2"
          density="compact"
          @click="emit('activate', layer.id)"
        >
          <v-text-field
            v-if="renaming === layer.id"
            v-model="newName"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
            aria-label="Layer name"
            @keydown.enter="finishRename(layer)"
            @keydown.esc="renaming = null"
            @blur="finishRename(layer)"
            @click.stop
          />
          <v-list-item-title v-else class="font-weight-medium">{{ layer.name }}</v-list-item-title>
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
            <v-menu v-if="editable">
              <template #activator="{ props: menu }">
                <v-btn v-bind="menu" :icon="mdiDotsVertical" size="x-small" variant="text" :aria-label="`More for ${layer.name}`" @click.stop />
              </template>
              <v-list density="compact">
                <v-list-item title="Rename" @click="startRename(layer)" />
                <v-list-item title="Move up" :prepend-icon="mdiArrowUp" :disabled="index === 0" @click="emit('move', layer, 1)" />
                <v-list-item
                  title="Move down"
                  :prepend-icon="mdiArrowDown"
                  :disabled="index === layers.length - 1"
                  @click="emit('move', layer, -1)"
                />
                <v-list-item title="Delete layer…" base-color="error" :disabled="layers.length === 1" @click="removing = layer" />
              </v-list>
            </v-menu>
          </template>
        </v-list-item>

        <v-list density="compact" class="py-0 ml-6 mr-2" bg-color="transparent">
          <v-list-item
            v-for="object in objectsOf(layer.id)"
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
