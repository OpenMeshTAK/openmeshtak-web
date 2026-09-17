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
  <!-- Plain icon buttons: v-btn-toggle adds group padding that misaligns a vertical bar. -->
  <v-sheet rounded="lg" elevation="2" class="editor-toolbar d-flex flex-column align-center pa-1 ga-1" role="toolbar" aria-label="Drawing tools">
    <v-tooltip v-for="item in tools" :key="item.value" :text="item.label" location="end">
      <template #activator="{ props: tooltip }">
        <v-btn
          v-bind="tooltip"
          :icon="item.icon"
          :variant="tool === item.value ? 'tonal' : 'text'"
          :color="tool === item.value ? 'primary' : undefined"
          size="small"
          rounded="lg"
          :aria-label="item.label"
          :aria-pressed="tool === item.value"
          :disabled="!editable && item.value !== 'select'"
          @click="tool = item.value"
        />
      </template>
    </v-tooltip>
    <v-divider class="align-self-stretch my-1" />
    <v-tooltip text="Zoom to content" location="end">
      <template #activator="{ props: tooltip }">
        <v-btn
          v-bind="tooltip"
          :icon="mdiFitToScreenOutline"
          variant="text"
          size="small"
          rounded="lg"
          aria-label="Zoom to content"
          @click="$emit('fit')"
        />
      </template>
    </v-tooltip>
  </v-sheet>
</template>
