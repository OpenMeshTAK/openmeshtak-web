<script setup lang="ts">
import "ol/ol.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { PackageGeometry, PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import type { LiveMapItem } from "../map/live-layer";
import type { MapContentItem } from "../map/map-content";
import { PackageMap, type EditorTool, type RemoteSelection } from "../map/package-map";
import { loadBaseMap, type BaseMapLayer } from "@/modules/map-settings/map-settings.api";
import { iconImageUrl, listLibraryIcons, type IconLibraryRef, type PackageIcon } from "../icon-libraries.api";
import { instanceIconUrl, loadInstanceIcons } from "@/modules/icon-settings/icon-settings.api";
import { readBaseMapId, storeBaseMapId } from "../editor-preferences";

const props = withDefaults(defineProps<{
  layers: PackageLayerDto[];
  objects: PackageObjectDto[];
  /** Read-only offline maps and rubber sheets. */
  contents?: MapContentItem[];
  /** Live TAK positions and markers drawn above everything else. */
  live?: LiveMapItem[];
  selectedId: string | null;
  /** Objects other editors have selected, outlined in their color. */
  remoteSelections?: RemoteSelection[];
  tool: EditorTool;
  editable?: boolean;
  iconLibraries?: IconLibraryRef[];
}>(), { contents: () => [], live: () => [], remoteSelections: () => [], editable: false, iconLibraries: () => [] });
const emit = defineEmits<{
  drawn: [geometry: PackageGeometry];
  modified: [objectId: string, geometry: PackageGeometry];
  select: [objectId: string | null];
  contextmenu: [target: { objectId: string | null; clientX: number; clientY: number; position: number[] }];
}>();

const container = ref<HTMLElement | null>(null);
const baseMaps = ref<BaseMapLayer[]>([]);
const activeBaseMapId = ref("");
let map: PackageMap | null = null;
let resizeObserver: ResizeObserver | null = null;
function selectBaseMap(id: string, remember = true): void {
  const layer = baseMaps.value.find((candidate) => candidate.id === id);
  if (layer === undefined) return;
  activeBaseMapId.value = layer.id;
  map?.setBaseMap(layer);
  if (remember) storeBaseMapId(layer.id);
}
const catalogues = new Map<string, PackageIcon[]>();
let iconGeneration = 0;
async function loadIcons(): Promise<void> {
  const generation = ++iconGeneration;
  const libraries = [...props.iconLibraries];
  const wanted = new Set(libraries.map((library) => library.contentId));
  for (const key of catalogues.keys()) if (!wanted.has(key)) catalogues.delete(key);
  const entries = await Promise.all(libraries.map(async (library) => {
    try {
      let icons = catalogues.get(library.contentId);
      if (icons === undefined) { icons = await listLibraryIcons(library); if (generation === iconGeneration) catalogues.set(library.contentId, icons); }
      return icons.map((icon): [string, string] => [`${library.packageId}:${icon.path}`, iconImageUrl(library, icon.id)]);
    } catch { return []; } // Missing/inaccessible libraries keep the own vector stand-ins.
  }));
  let shared: Array<[string, string]> = [];
  try {
    const catalogue = await loadInstanceIcons();
    shared = catalogue.icons.map((icon) => [`*:${icon.path}`, instanceIconUrl(catalogue.version, icon.id)]);
  } catch { /* Shared icons are optional; keep package images and vector stand-ins. */ }
  if (generation === iconGeneration) map?.setIconUrls(new Map([...shared, ...entries.flat()]));
}

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
  map.setEditable(props.editable);
  map.setContent(props.layers, props.objects);
  void loadIcons();
  map.setMapContent(props.contents, props.layers);
  map.setLiveItems(props.live);
  map.setRemoteSelections(props.remoteSelections);
  void loadBaseMap().then((settings) => {
    if (map === null) return;
    baseMaps.value = settings.layers;
    const remembered = readBaseMapId();
    const selected = settings.layers.find(({ id }) => id === remembered)
      ?? settings.layers.find(({ id }) => id === settings.defaultLayerId)
      ?? settings.layers[0];
    // A temporary settings fallback must not overwrite the operator's remembered choice.
    if (selected !== undefined) selectBaseMap(selected.id, false);
  });
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
watch(() => props.remoteSelections, (selections) => map?.setRemoteSelections(selections));
watch(() => props.tool, (tool) => map?.setTool(tool));
watch(() => props.iconLibraries, () => { void loadIcons(); });
watch(() => props.editable, (editable) => { map?.setEditable(editable); map?.setTool(props.tool); });
watch(() => props.selectedId, (objectId) => map?.highlight(objectId));

onBeforeUnmount(() => {
  iconGeneration += 1;
  resizeObserver?.disconnect();
  map?.dispose();
  map = null;
});

defineExpose({
  baseMaps,
  activeBaseMapId,
  selectBaseMap,
  clearMeasurements: () => map?.clearMeasurements(),
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
/* Bottom centre stays free: the layer panel floats on the left and the inspector on the right. */
.package-map :deep(.editor-scale) {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 8px 4px;
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.85);
  pointer-events: none;
}
.package-map :deep(.editor-scale-inner) {
  border: 2px solid rgb(var(--v-theme-on-surface));
  border-top: none;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  will-change: contents, width;
}
</style>
