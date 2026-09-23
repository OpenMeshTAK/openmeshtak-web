<script setup lang="ts">
import { mdiCrosshairsGps, mdiDelete, mdiDotsVertical, mdiEye, mdiEyeOff, mdiImageArea, mdiMap, mdiPencil } from "@mdi/js";
import { computed, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import type { ContentChanges, PackageContentDto } from "@/modules/data-packages/data-packages.api";

/**
 * One offline map or rubber sheet in the layer list. Visibility and opacity only change the
 * editor display; the file is exported unchanged.
 */
const props = defineProps<{ content: PackageContentDto; editable: boolean; locked: boolean; layerVisible: boolean }>();
const emit = defineEmits<{ change: [changes: ContentChanges]; remove: []; zoom: [] }>();

const renaming = ref(false);
const newName = ref("");
const removing = ref(false);
const menuOpen = ref(false);
const opacity = ref(props.content.opacity);

const isRubberSheet = computed(() => props.content.kind === "rubber-sheet");
const subtitle = computed(() => {
  const map = props.content.offlineMap;
  if (isRubberSheet.value) {
    return "Rubber sheet";
  }
  return map === null ? "Map file" : `Offline map · zoom ${map.minZoom}–${map.maxZoom}`;
});

function startRename(): void {
  menuOpen.value = false;
  newName.value = props.content.name;
  renaming.value = true;
}

function finishRename(): void {
  const name = newName.value.trim();
  renaming.value = false;
  if (name !== "" && name !== props.content.name) {
    emit("change", { name });
  }
}
</script>

<template>
  <div>
    <v-list-item
      :prepend-icon="isRubberSheet ? mdiImageArea : mdiMap"
      prepend-gap="10"
      class="ps-2"
      rounded="lg"
      density="compact"
      :class="{ 'text-disabled': !layerVisible || !content.visible }"
      :data-content-id="content.id"
      @dblclick="editable && !locked && startRename()"
    >
      <v-text-field
        v-if="renaming"
        v-model="newName"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        maxlength="200"
        aria-label="Map name"
        @keydown.enter="finishRename"
        @keydown.esc="renaming = false"
        @blur="finishRename"
        @click.stop
      />
      <template v-else>
        <v-list-item-title>{{ content.name }}</v-list-item-title>
        <v-list-item-subtitle>{{ subtitle }}</v-list-item-subtitle>
      </template>
      <template #append>
        <v-btn
          :icon="content.visible ? mdiEye : mdiEyeOff"
          size="x-small"
          variant="text"
          :disabled="!editable"
          :aria-label="content.visible ? `Hide ${content.name}` : `Show ${content.name}`"
          @click.stop="emit('change', { visible: !content.visible })"
        />
        <!-- The opacity slider needs the menu to stay open on clicks; actions close it themselves. -->
        <v-menu v-model="menuOpen" :close-on-content-click="false">
          <template #activator="{ props: menu }">
            <v-btn v-bind="menu" :icon="mdiDotsVertical" size="x-small" variant="text" :aria-label="`More for ${content.name}`" @click.stop="opacity = content.opacity" />
          </template>
          <v-list density="compact" min-width="240">
            <v-list-item title="Zoom to" :prepend-icon="mdiCrosshairsGps" @click="(menuOpen = false), emit('zoom')" />
            <v-list-item v-if="editable" title="Rename" :prepend-icon="mdiPencil" :disabled="locked" @click="startRename" />
            <div class="px-4 pt-2">
              <div class="text-caption text-medium-emphasis">Opacity {{ Math.round(opacity * 100) }} %</div>
              <v-slider
                v-model="opacity"
                :min="0.1"
                :max="1"
                :step="0.05"
                :disabled="!editable"
                hide-details
                color="primary"
                aria-label="Opacity"
                @end="emit('change', { opacity })"
              />
            </div>
            <template v-if="editable">
              <v-divider class="my-1" />
              <v-list-item
                title="Remove from data package…"
                :prepend-icon="mdiDelete"
                base-color="error"
                :disabled="locked"
                @click="(menuOpen = false), (removing = true)"
              />
            </template>
          </v-list>
        </v-menu>
      </template>
    </v-list-item>

    <ConfirmDialog
      :model-value="removing"
      title="Remove this map?"
      confirm-label="Remove"
      confirm-color="error"
      @update:model-value="removing = false"
      @confirm="(removing = false), emit('remove')"
    >
      {{ content.name }} is removed from the draft. Published revisions keep it.
    </ConfirmDialog>
  </div>
</template>
