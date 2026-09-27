<script setup lang="ts">
import "ol/ol.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { PackageGeometry, PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import type { LiveMapItem } from "../map/live-layer";
import type { MapContentItem } from "../map/map-content";
import { PackageMap, type EditorTool } from "../map/package-map";

const props = withDefaults(defineProps<{
  layers: PackageLayerDto[];
  objects: PackageObjectDto[];
  /** Read-only offline maps and rubber sheets. */
  contents?: MapContentItem[];
  /** Live TAK positions and markers drawn above everything else. */
  live?: LiveMapItem[];
  selectedId: string | null;
  tool: EditorTool;
}>(), { contents: () => [], live: () => [] });
const emit = defineEmits<{
  drawn: [geometry: PackageGeometry];
  modified: [objectId: string, geometry: PackageGeometry];
  select: [objectId: string | null];
  contextmenu: [target: { objectId: string | null; clientX: number; clientY: number; position: number[] }];
}>();

const container = ref<HTMLElement | null>(null);
let map: PackageMap | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (container.value === null) {
    return;
  }
  map = new PackageMap(container.value, {
    onDrawn: (geometry) => emit("drawn", geometry),
    onModified: (objectId, geometry) => emit("modified", objectId, geometry),
    onSelected: (objectId) => emit("select", objectId),
    onContextMenu: (target) => emit("contextmenu", target),
  });
  map.setContent(props.layers, props.objects);
  map.setMapContent(props.contents, props.layers);
  map.setLiveItems(props.live);
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
watch(
  () => [props.contents, props.layers] as const,
  ([contents, layers]) => map?.setMapContent(contents, layers),
);
watch(() => props.live, (items) => map?.setLiveItems(items));
watch(() => props.tool, (tool) => map?.setTool(tool));
watch(() => props.selectedId, (objectId) => map?.highlight(objectId));

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  map?.dispose();
  map = null;
});

defineExpose({
  zoomToLive: (uid: string) => map?.zoomToLive(uid),
  fitToContent: () => map?.fitToContent(),
  zoomToContent: (contentId: string) => map?.zoomToContent(contentId),
  pointerPosition: () => map?.pointerPosition() ?? null,
});
</script>

<template>
  <div ref="container" class="package-map" role="application" aria-label="Data package map" />
</template>

<style scoped>
.package-map {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
