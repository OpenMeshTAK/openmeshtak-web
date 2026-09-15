<script setup lang="ts">
import "ol/ol.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { MissionGeometry, MissionLayerDto, MissionObjectDto } from "@/modules/missions/missions.api";
import { MissionMap, type EditorTool } from "../map/mission-map";

const props = defineProps<{
  layers: MissionLayerDto[];
  objects: MissionObjectDto[];
  selectedId: string | null;
  tool: EditorTool;
}>();
const emit = defineEmits<{
  drawn: [geometry: MissionGeometry];
  modified: [objectId: string, geometry: MissionGeometry];
  select: [objectId: string | null];
}>();

const container = ref<HTMLElement | null>(null);
let map: MissionMap | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (container.value === null) {
    return;
  }
  map = new MissionMap(container.value, {
    onDrawn: (geometry) => emit("drawn", geometry),
    onModified: (objectId, geometry) => emit("modified", objectId, geometry),
    onSelected: (objectId) => emit("select", objectId),
  });
  map.setContent(props.layers, props.objects);
  map.setTool(props.tool);
  map.highlight(props.selectedId);
  map.fitToContent();
  // Panels around the map change its size without a window resize.
  resizeObserver = new ResizeObserver(() => map?.updateSize());
  resizeObserver.observe(container.value);
});

watch(
  () => [props.layers, props.objects] as const,
  ([layers, objects]) => map?.setContent(layers, objects),
);
watch(() => props.tool, (tool) => map?.setTool(tool));
watch(() => props.selectedId, (objectId) => map?.highlight(objectId));

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  map?.dispose();
  map = null;
});

defineExpose({ fitToContent: () => map?.fitToContent() });
</script>

<template>
  <div ref="container" class="mission-map" role="application" aria-label="Mission map" />
</template>

<style scoped>
.mission-map {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
