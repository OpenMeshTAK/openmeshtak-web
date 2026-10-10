<script setup lang="ts">
import {
  mdiBroom, mdiCheck, mdiChevronDown, mdiCircleOutline, mdiCursorDefault, mdiDraw,
  mdiEllipseOutline, mdiFitToScreenOutline, mdiGrid, mdiLayersOutline, mdiMapMarkerPlusOutline, mdiMapOutline,
  mdiRectangleOutline, mdiRedo, mdiRoutes, mdiRuler, mdiShapePolygonPlus, mdiUndo,
  mdiVectorPolyline, mdiVectorSquare, mdiArrowTopRight, mdiAngleAcute, mdiCompassOutline,
} from "@mdi/js";
import { computed, ref } from "vue";
import type { EditorTool } from "../map/package-map";
import type { BaseMapLayer } from "@/modules/map-settings/map-settings.api";
import { DISTANCE_UNITS, type DistanceUnit } from "../map/range-bearing";
import { DEFAULT_GRID_SETTINGS, type GridSettings } from "../map/mgrs-grid";
import SegmentedControl from "@/shared/components/SegmentedControl.vue";
import InspectorToggle from "./InspectorToggle.vue";

const props = withDefaults(defineProps<{
  editable: boolean;
  layersOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string | null;
  redoLabel?: string | null;
  baseMaps?: BaseMapLayer[];
  baseMapId?: string;
  viewOnly?: boolean;
  layersLabel?: string;
  distanceUnit?: DistanceUnit;
  gridVisible?: boolean;
  gridSettings?: GridSettings;
}>(), { gridVisible: false, gridSettings: () => DEFAULT_GRID_SETTINGS, distanceUnit: "m", undoLabel: null, redoLabel: null, baseMaps: () => [], baseMapId: "", viewOnly: false, layersLabel: "layers" });
const tool = defineModel<EditorTool>("tool", { required: true });
defineEmits<{ fit: []; toggleLayers: []; undo: []; redo: []; clearMeasurements: []; changeBaseMap: [id: string]; changeDistanceUnit: [unit: DistanceUnit]; toggleGrid: []; changeGridSettings: [settings: GridSettings] }>();
const gridSpacings: Array<{ title: string; value: GridSettings["spacing"] }> = [
  { title: "Auto", value: "auto" }, { title: "100 km", value: 100_000 }, { title: "10 km", value: 10_000 }, { title: "1 km", value: 1_000 }, { title: "100 m", value: 100 },
];
const gridTones: Array<{ title: string; value: GridSettings["tone"] }> = [{ title: "Dark", value: "dark" }, { title: "Light", value: "light" }];
const gridWidths: Array<{ title: string; value: GridSettings["width"] }> = [{ title: "Thin", value: "thin" }, { title: "Normal", value: "normal" }, { title: "Thick", value: "thick" }];

interface ToolChoice { value: EditorTool; icon: string; label: string; hint?: string }
interface ToolGroup { id: string; label: string; icon: string; editing: boolean; items: ToolChoice[] }
const openGroup = ref<string | null>(null);
const baseMapTooltip = computed(() => "Base map: " + (props.baseMaps.find(({ id }) => id === props.baseMapId)?.providerName ?? "Choose map"));
const layersTooltip = computed(() => (props.layersOpen ? "Hide " : "Show ") + props.layersLabel);
const directTools: ToolChoice[] = [
  { value: "select", icon: mdiCursorDefault, label: "Select and move (S)", hint: "Shift/Ctrl-click selects multiple objects; Shift + drag moves a drawing" },
  { value: "point", icon: mdiMapMarkerPlusOutline, label: "Add marker (M)" },
];
const groups: ToolGroup[] = [
  { id: "lines", label: "Lines and routes", icon: mdiVectorPolyline, editing: true, items: [
    { value: "line", icon: mdiVectorPolyline, label: "Line (L)" },
    { value: "arrow", icon: mdiArrowTopRight, label: "Arrow (D)", hint: "Two clicks finish; Shift adds more points" },
    { value: "freehand", icon: mdiDraw, label: "Freehand (F)", hint: "Shift + drag in Select mode moves the whole drawing" },
    { value: "route", icon: mdiRoutes, label: "Route (T)", hint: "Two clicks finish; Shift adds more points" },
    { value: "range-bearing", icon: mdiCompassOutline, label: "Save Range & Bearing (B)", hint: "Two points; saved and published with the package" },
  ] },
  { id: "shapes", label: "Shapes", icon: mdiShapePolygonPlus, editing: true, items: [
    { value: "polygon", icon: mdiShapePolygonPlus, label: "Area (A)" },
    { value: "circle", icon: mdiCircleOutline, label: "Circle (C)" },
    { value: "range-circle", icon: mdiCircleOutline, label: "Range rings", hint: "Draw the first ring; set the ring count in the inspector" },
    { value: "bullseye", icon: mdiCompassOutline, label: "Bullseye", hint: "Draw the outer radius; set the rings in the inspector" },
    { value: "rectangle", icon: mdiRectangleOutline, label: "Rectangle (R)", hint: "Hold Shift while drawing for a square" },
    { value: "ellipse", icon: mdiEllipseOutline, label: "Ellipse (E)", hint: "Shift draws a circle; Shift + drag on the rotation handle snaps to 15°" },
    { value: "sector", icon: mdiAngleAcute, label: "Bearing sector (V)", hint: "Place the centre, then drag the handles; Shift snaps to 15°" },
  ] },
  { id: "measure", label: "Measure", icon: mdiRuler, editing: false, items: [
    { value: "measure-length", icon: mdiRuler, label: "Distance (Q)", hint: "Two clicks to finish; hold Shift to add points" },
    { value: "measure-area", icon: mdiVectorSquare, label: "Area and perimeter (W)", hint: "Click the boundary points, then double-click to finish" },
    { value: "measure-bearing", icon: mdiCompassOutline, label: "Temporary Range & Bearing (N)", hint: "Two points; not saved or published" },
  ] },
];
const visibleGroups = computed(() => groups.filter((group) => props.editable || !group.editing));
const visibleDirectTools = computed(() => directTools.filter((item) => props.editable || item.value === "select"));
function activeChoice(group: ToolGroup): ToolChoice | undefined {
  return group.items.find((item) => item.value === tool.value);
}
function groupTooltip(group: ToolGroup): string {
  const active = activeChoice(group);
  return active === undefined ? group.label : choiceTooltip(active);
}
function choiceTooltip(item: ToolChoice): string {
  return item.hint ? item.label + " · " + item.hint : item.label;
}
function choose(value: EditorTool): void {
  tool.value = value;
  openGroup.value = null;
}
</script>

<template>
  <v-sheet rounded="lg" elevation="2" class="editor-toolbar" role="toolbar" :aria-label="viewOnly ? 'Map view' : 'Map tools'" aria-orientation="vertical">
    <div class="toolbar-section" role="group" aria-label="Map view">
      <v-tooltip :text="layersTooltip" location="end">
        <template #activator="{ props: tooltip }">
          <v-btn v-bind="tooltip" :icon="mdiLayersOutline" :variant="layersOpen ? 'tonal' : 'text'" size="small" rounded="lg" :aria-label="layersTooltip" :aria-pressed="layersOpen" @click="$emit('toggleLayers')" />
        </template>
      </v-tooltip>
      <v-menu v-if="baseMaps.length > 1" :model-value="openGroup === 'base-maps'" location="end top" offset="8" @update:model-value="openGroup = $event ? 'base-maps' : null">
        <template #activator="{ props: menu }">
          <v-tooltip :text="baseMapTooltip" location="end">
            <template #activator="{ props: tooltip }">
              <v-btn v-bind="{ ...tooltip, ...menu }" icon variant="text" size="small" rounded="lg" :aria-label="baseMapTooltip">
                <v-icon :icon="mdiMapOutline" />
                <v-icon :icon="mdiChevronDown" size="12" class="tool-chevron" />
              </v-btn>
            </template>
          </v-tooltip>
        </template>
        <v-list density="compact" min-width="220" max-width="320" rounded="lg" elevation="2" class="toolbar-map-popout" aria-label="Available base maps">
          <v-list-item v-for="layer in baseMaps" :key="layer.id" :title="layer.providerName" :prepend-icon="mdiMapOutline" :active="layer.id === baseMapId" color="primary" rounded="lg" @click="$emit('changeBaseMap', layer.id); openGroup = null">
            <template #append><v-icon v-if="layer.id === baseMapId" :icon="mdiCheck" size="small" /></template>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-menu :model-value="openGroup === 'grid'" location="end top" offset="8" :close-on-content-click="false" @update:model-value="openGroup = $event ? 'grid' : null">
        <template #activator="{ props: menu }">
          <v-tooltip text="MGRS grid" location="end">
            <template #activator="{ props: tooltip }">
              <v-btn v-bind="{ ...tooltip, ...menu }" icon :variant="gridVisible ? 'tonal' : 'text'" size="small" rounded="lg" aria-label="MGRS grid">
                <v-icon :icon="mdiGrid" />
                <v-icon :icon="mdiChevronDown" size="12" class="tool-chevron" />
              </v-btn>
            </template>
          </v-tooltip>
        </template>
        <v-card min-width="260" rounded="lg" elevation="2" class="grid-popout" aria-label="MGRS grid">
          <InspectorToggle label="Show MGRS grid" :model-value="gridVisible" @update:model-value="$emit('toggleGrid')" />
          <div class="grid-popout__label">Line spacing</div>
          <SegmentedControl :model-value="gridSettings.spacing" :options="gridSpacings" label="Grid line spacing" @update:model-value="$emit('changeGridSettings', { ...gridSettings, spacing: $event })" />
          <div class="grid-popout__label">Line colour</div>
          <SegmentedControl :model-value="gridSettings.tone" :options="gridTones" label="Grid line colour" @update:model-value="$emit('changeGridSettings', { ...gridSettings, tone: $event })" />
          <div class="grid-popout__label">Line width</div>
          <SegmentedControl :model-value="gridSettings.width" :options="gridWidths" label="Grid line width" @update:model-value="$emit('changeGridSettings', { ...gridSettings, width: $event })" />
          <InspectorToggle label="Grid labels" class="mt-2" :model-value="gridSettings.labels" @update:model-value="$emit('changeGridSettings', { ...gridSettings, labels: $event })" />
        </v-card>
      </v-menu>
      <v-tooltip text="Zoom to content" location="end">
        <template #activator="{ props: tooltip }">
          <v-btn v-bind="tooltip" :icon="mdiFitToScreenOutline" variant="text" size="small" rounded="lg" aria-label="Zoom to content" @click="$emit('fit')" />
        </template>
      </v-tooltip>
    </div>
    <v-divider v-if="!viewOnly" class="toolbar-divider" />
    <div v-if="!viewOnly" class="toolbar-section" role="group" aria-label="Drawing and measuring">
      <v-tooltip v-for="item in visibleDirectTools" :key="item.value" :text="choiceTooltip(item)" max-width="320" location="end">
        <template #activator="{ props: tooltip }">
          <v-btn v-bind="tooltip" :icon="item.icon" :variant="tool === item.value ? 'tonal' : 'text'" :color="tool === item.value ? 'primary' : undefined" size="small" rounded="lg" :aria-label="item.label" :aria-pressed="tool === item.value" @click="choose(item.value)" />
        </template>
      </v-tooltip>
      <v-menu v-for="group in visibleGroups" :key="group.id" :model-value="openGroup === group.id" location="end top" offset="8" @update:model-value="openGroup = $event ? group.id : null">
        <template #activator="{ props: menu }">
          <v-tooltip :text="groupTooltip(group)" max-width="320" location="end">
            <template #activator="{ props: tooltip }">
              <v-btn v-bind="{ ...tooltip, ...menu }" icon :variant="activeChoice(group) ? 'tonal' : 'text'" :color="activeChoice(group) ? 'primary' : undefined" size="small" rounded="lg" :aria-label="groupTooltip(group)" :aria-pressed="Boolean(activeChoice(group))">
                <v-icon :icon="activeChoice(group)?.icon ?? group.icon" />
                <v-icon :icon="mdiChevronDown" size="12" class="tool-chevron" />
              </v-btn>
            </template>
          </v-tooltip>
        </template>
        <v-sheet rounded="lg" elevation="2" class="toolbar-popout" role="group" :aria-label="group.label">
          <v-tooltip v-for="item in group.items" :key="item.value" :text="choiceTooltip(item)" max-width="320" location="top">
            <template #activator="{ props: tooltip }">
              <v-btn v-bind="tooltip" :icon="item.icon" :variant="tool === item.value ? 'tonal' : 'text'" :color="tool === item.value ? 'primary' : undefined" size="small" rounded="lg" :aria-label="item.label" :aria-pressed="tool === item.value" @click="choose(item.value)" />
            </template>
          </v-tooltip>
          <template v-if="group.id === 'measure'">
            <v-select :model-value="distanceUnit ?? 'm'" :items="DISTANCE_UNITS" label="Distance unit" density="compact" hide-details style="min-width: 110px" @update:model-value="$emit('changeDistanceUnit', $event)" />
            <v-divider vertical class="popout-divider" />
            <v-tooltip text="Clear measurements" location="top">
              <template #activator="{ props: tooltip }">
                <v-btn v-bind="tooltip" :icon="mdiBroom" variant="text" size="small" rounded="lg" aria-label="Clear measurements" @click="$emit('clearMeasurements'); openGroup = null" />
              </template>
            </v-tooltip>
          </template>
        </v-sheet>
      </v-menu>
    </div>
    <template v-if="editable && !viewOnly">
      <v-divider class="toolbar-divider" />
      <div class="toolbar-section" role="group" aria-label="Edit history">
        <v-tooltip :text="undoLabel ? 'Undo ' + undoLabel + ' (Ctrl+Z)' : 'Nothing to undo'" location="end">
          <template #activator="{ props: tooltip }">
            <v-btn v-bind="tooltip" :icon="mdiUndo" variant="text" size="small" rounded="lg" aria-label="Undo" :disabled="!canUndo" @click="$emit('undo')" />
          </template>
        </v-tooltip>
        <v-tooltip :text="redoLabel ? 'Redo ' + redoLabel + ' (Ctrl+Shift+Z)' : 'Nothing to redo'" location="end">
          <template #activator="{ props: tooltip }">
            <v-btn v-bind="tooltip" :icon="mdiRedo" variant="text" size="small" rounded="lg" aria-label="Redo" :disabled="!canRedo" @click="$emit('redo')" />
          </template>
        </v-tooltip>
      </div>
    </template>
  </v-sheet>
</template>

<style scoped>
.editor-toolbar { display: flex; flex-direction: column; align-items: center; padding: 4px; max-height: calc(100dvh - 180px); overflow-y: auto; }
.toolbar-section { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
.toolbar-divider { align-self: stretch; margin: 6px 0; flex-shrink: 0; }
.tool-chevron { position: absolute; bottom: 2px; right: 2px; }
.toolbar-popout { display: flex; align-items: center; gap: 4px; padding: 4px; }
.popout-divider { height: 24px; align-self: center; margin: 0 2px; }
.toolbar-map-popout { padding: 4px; }
.grid-popout { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px 12px; }
.grid-popout__label { margin-top: 6px; font-size: 0.75rem; color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
.toolbar-map-popout :deep(.v-list-item) { min-height: 36px; }
.toolbar-map-popout :deep(.v-list-item__prepend > .v-icon) { margin-inline-end: 12px; }
</style>
