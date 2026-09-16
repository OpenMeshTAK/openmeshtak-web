<script setup lang="ts">
import {
  mdiCircleOutline,
  mdiCursorDefault,
  mdiFitToScreenOutline,
  mdiMapMarkerPlusOutline,
  mdiShapePolygonPlus,
  mdiVectorPolyline,
} from "@mdi/js";
import type { EditorTool } from "../map/package-map";

defineProps<{ editable: boolean }>();
const tool = defineModel<EditorTool>("tool", { required: true });
defineEmits<{ fit: [] }>();

const tools = [
  { value: "select", icon: mdiCursorDefault, label: "Select and move (S)" },
  { value: "point", icon: mdiMapMarkerPlusOutline, label: "Add marker (M)" },
  { value: "line", icon: mdiVectorPolyline, label: "Draw line (L)" },
  { value: "polygon", icon: mdiShapePolygonPlus, label: "Draw area (A)" },
  { value: "circle", icon: mdiCircleOutline, label: "Draw circle (C)" },
] as const;
</script>

<template>
  <v-sheet rounded="lg" elevation="2" class="editor-toolbar d-flex flex-column pa-1 ga-1">
    <v-btn-toggle v-model="tool" mandatory divided direction="vertical" density="comfortable" variant="text">
      <v-tooltip v-for="item in tools" :key="item.value" :text="item.label" location="end">
        <template #activator="{ props: tooltip }">
          <v-btn
            v-bind="tooltip"
            :value="item.value"
            :icon="item.icon"
            :aria-label="item.label"
            :disabled="!editable && item.value !== 'select'"
          />
        </template>
      </v-tooltip>
    </v-btn-toggle>
    <v-divider />
    <v-tooltip text="Zoom to content" location="end">
      <template #activator="{ props: tooltip }">
        <v-btn v-bind="tooltip" :icon="mdiFitToScreenOutline" variant="text" aria-label="Zoom to content" @click="$emit('fit')" />
      </template>
    </v-tooltip>
  </v-sheet>
</template>
