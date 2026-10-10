<script setup lang="ts">
import { DEFAULT_GRID_SETTINGS } from "@/modules/editor/map/mgrs-grid";
import { mdiAccessPointNetwork, mdiArrowLeft } from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import EditorToolbar from "@/modules/editor/components/EditorToolbar.vue";
import PackageMapView from "@/modules/editor/components/PackageMapView.vue";
import HistoryAnalysis from "./history/HistoryAnalysis.vue";
import HistoryFilterBar, { type HistoryFilterForm } from "./history/HistoryFilterBar.vue";
import HistoryTimeline from "./history/HistoryTimeline.vue";
import { createHistoryLayers } from "./history/history-layer";
import { coverageCells } from "./history/track-analysis";
import { formatAge, lastKnownAt, timeSpan, toTimelineTracks, type TimelineTrack } from "./history/track-timeline";
import ContactList from "./contacts/ContactList.vue";
import { DEFAULT_FILTER, type ContactFilter, type ContactRow } from "./contacts/contact-list";
import {
  deleteRecordedTakTraffic,
  getTakTrafficHistory,
  getTakTrafficRecording,
  takTrackExportUrl,
  type TakTrafficHistoryDto,
  type TakTrafficHistoryFilter,
  type TakTrafficRecordingDto,
} from "./tak-server.api";
import { useEventMapContent } from "./useEventMapContent";

/**
 * Timeline, replay and analysis of an event's recorded TAK positions on the read-only event map.
 * It only shows what Core recorded while the event's recording was on; nothing is interpolated.
 */
const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();
const eventId = String(route.params.eventId);
const canDelete = computed(() => session.can("tak-traffic.delete", eventId));

const TRACK_COLORS = ["#1e88e5", "#e53935", "#43a047", "#fb8c00", "#8e24aa", "#00acc1", "#6d4c41", "#d81b60", "#7cb342", "#3949ab"];
const HOUR_MS = 3_600_000;

const { layers: mapLayers, objects, contents, load: loadPackages } = useEventMapContent(eventId);
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const history = createHistoryLayers();
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const loading = ref(false);
const recording = ref<TakTrafficRecordingDto | null>(null);
const result = shallowRef<TakTrafficHistoryDto | null>(null);
const loadedFilter = ref<TakTrafficHistoryFilter | null>(null);
const tracks = shallowRef<TimelineTrack[]>([]);
const hidden = ref(new Set<string>());
const contactFilter = ref<ContactFilter>({ ...DEFAULT_FILTER });
const cursor = ref(Date.now());
const trailMs = ref<number | null>(null);
const panelOpen = ref(true);
const panelTab = ref<"tracks" | "analysis">("tracks");
const coverage = ref(false);
const cellMetres = ref(250);
const areaId = ref<string | null>(null);
const deleting = ref<string | null>(null);
const deleteBusy = ref(false);

function localInput(time: number): string {
  const date = new Date(time - new Date(time).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

const form = ref<HistoryFilterForm>({ from: localInput(Date.now() - 6 * HOUR_MS), to: localInput(Date.now()), groupId: null, gapSeconds: 300 });

const colored = computed(() => tracks.value.map((track, index) => ({ track, color: TRACK_COLORS[index % TRACK_COLORS.length] as string })));
// "Devices" or "markers" in the filter applies to the map as well; search and status only narrow the list.
const listed = computed(() => {
  const kind = contactFilter.value.kind;
  return colored.value.filter(({ track }) => kind === "all" || (kind === "devices") === track.selfReported);
});
const shown = computed(() => listed.value.filter(({ track }) => !hidden.value.has(track.uid)));
const span = computed(() => {
  const loaded = loadedFilter.value;
  return loaded === null ? null : { start: Date.parse(loaded.from), end: Date.parse(loaded.to) };
});
const exportLinks = computed(() => {
  const loaded = loadedFilter.value;
  return loaded === null || !session.can("tak-traffic.export", eventId) ? null : { geojson: takTrackExportUrl(eventId, "geojson", loaded), gpx: takTrackExportUrl(eventId, "gpx", loaded) };
});
const positions = computed(() => tracks.value.reduce((sum, { pointCount }) => sum + pointCount, 0));
const staleAfterMs = computed(() => (result.value?.gapSeconds ?? 300) * 1000);

async function load(): Promise<void> {
  const from = new Date(form.value.from);
  const to = new Date(form.value.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    toast.error("Choose a start before the end.");
    return;
  }
  const filter: TakTrafficHistoryFilter = {
    from: from.toISOString(),
    to: to.toISOString(),
    groupId: form.value.groupId ?? undefined,
    gapSeconds: form.value.gapSeconds,
  };
  loading.value = true;
  try {
    const loaded = await getTakTrafficHistory(eventId, filter);
    result.value = loaded;
    loadedFilter.value = filter;
    tracks.value = toTimelineTracks(loaded.tracks);
    hidden.value = new Set();
    cursor.value = timeSpan(tracks.value)?.end ?? to.getTime();
    history.setTracks(shown.value);
    const extent = history.extent();
    if (extent !== null) mapView.value?.fitExtent(extent);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    loading.value = false;
  }
}

function focus(uid: string): void {
  const position = history.positionOf(uid);
  if (position !== null) mapView.value?.centerOn(position);
}

async function confirmDelete(): Promise<void> {
  if (deleting.value === null) return;
  deleteBusy.value = true;
  try {
    const { deleted } = await deleteRecordedTakTraffic(eventId, deleting.value);
    toast.success(`${String(deleted)} recorded positions deleted.`);
    deleting.value = null;
    await load();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    deleteBusy.value = false;
  }
}

// The overlay joins the map once it exists; the map is created when the view is ready.
watch(mapView, (view) => view?.addOverlayLayers(history.layers));

// Projecting is done once per change of the shown tracks, not on every replay frame.
watch(shown, (list) => history.setTracks(list), { immediate: true });
watchEffect(() => {
  void shown.value;
  history.render({
    cursor: cursor.value,
    trailMs: trailMs.value,
    staleAfterMs: staleAfterMs.value,
    // Minutes only on the map: a label that changes every replay second would be redrawn every frame.
    label: (track, age) => (age < 60_000 ? track.label : `${track.label} · ${formatAge(age)} ago`),
  });
});

// The list shows ages in seconds; refreshing it twice a second is enough even at high replay speed.
const listCursor = ref(cursor.value);
let listTimer: ReturnType<typeof setTimeout> | undefined;
watch(cursor, () => {
  listTimer ??= setTimeout(() => {
    listTimer = undefined;
    listCursor.value = cursor.value;
  }, 500);
});
onBeforeUnmount(() => clearTimeout(listTimer));

const contactRows = computed<ContactRow[]>(() =>
  colored.value.map(({ track, color }) => {
    const known = lastKnownAt(track, listCursor.value);
    const ageMs = known === null ? null : listCursor.value - known.time;
    return {
      key: track.uid,
      label: track.label,
      group: track.groupName,
      color,
      ageMs,
      stale: ageMs !== null && ageMs > staleAfterMs.value,
      device: track.selfReported,
      details: [
        track.groupName === null ? track.senderName : `${track.senderName} · ${track.groupName}`,
        [
          `${String(track.pointCount)} positions`,
          track.delayedCount > 0 ? `${String(track.delayedCount)} late` : null,
          track.approximateCount > 0 ? `${String(track.approximateCount)} approximate` : null,
          track.duplicatesDropped > 0 ? `${String(track.duplicatesDropped)} duplicates dropped` : null,
        ].filter((part) => part !== null).join(" · "),
      ],
      searchText: track.senderName,
    };
  }),
);

watchEffect(() => {
  const cells = coverage.value ? coverageCells(shown.value.map(({ track }) => track), cellMetres.value) : [];
  history.setCoverage(cells, "#fb8c00");
});

onMounted(async () => {
  try {
    const [settings] = await Promise.all([getTakTrafficRecording(eventId), loadPackages()]);
    recording.value = settings;
    state.value = "ready";
    await load();
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
});
</script>

<template>
  <div class="history-view">
    <header class="history-header d-flex align-center ga-3 px-4">
      <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Back to the event" @click="router.push({ name: 'event-detail', params: { eventId } })" />
      <div class="flex-grow-1">
        <div class="text-title-medium font-weight-medium">TAK history</div>
        <div class="text-body-small text-medium-emphasis d-flex align-center ga-1">
          <span>
            {{ tracks.length }} tracks · {{ positions }} positions
            <template v-if="recording !== null"> · recording {{ recording.enabled ? `on, kept ${recording.retentionDays} days` : "off" }}</template>
          </span>
          <InfoHint v-if="result?.truncated" tone="warning" label="Not all positions loaded">
            This range holds more than {{ result.maxPoints }} positions, so the newest are missing. Choose a shorter range or one group.
          </InfoHint>
        </div>
      </div>
      <v-btn v-if="session.can('tak-traffic.view', eventId)" :to="{ name: 'event-live', params: { eventId } }" variant="text" size="small" :prepend-icon="mdiAccessPointNetwork">Live</v-btn>
    </header>

    <ErrorState v-if="state === 'error'" :message="error" class="ma-6" />
    <v-skeleton-loader v-else-if="state === 'loading'" type="image" class="ma-6" />
    <template v-else>
      <HistoryFilterBar v-model="form" :groups="result?.groups ?? []" :loading="loading" :export-links="exportLinks" @load="load" />
      <main class="history-body">
        <PackageMapView ref="mapView" :layers="mapLayers" :objects="objects" :contents="contents" :selected-id="null" tool="select" />

        <EditorToolbar
          tool="select"
          view-only
          :editable="false"
          :can-undo="false"
          :can-redo="false"
          :layers-open="panelOpen"
          layers-label="tracks"
          :base-maps="mapView?.baseMaps ?? []"
          :base-map-id="mapView?.activeBaseMapId ?? ''"
          class="history-toolbar"
          :grid-visible="mapView?.gridVisible ?? false"
          :grid-settings="mapView?.gridSettings ?? DEFAULT_GRID_SETTINGS"
          @toggle-layers="panelOpen = !panelOpen"
          @change-base-map="mapView?.selectBaseMap($event)"
          @fit="mapView?.fitToContent()"
          @toggle-grid="mapView?.setGridVisible(!(mapView?.gridVisible ?? false))"
          @change-grid-settings="mapView?.setGridSettings($event)"
        />

        <v-sheet v-if="panelOpen" elevation="4" rounded="lg" class="history-panel" :class="{ 'history-panel--tracks': panelTab === 'tracks' }">
          <v-tabs v-model="panelTab" density="compact" grow class="flex-0-0">
            <v-tab value="tracks">Tracks</v-tab>
            <v-tab value="analysis">Analysis</v-tab>
          </v-tabs>
          <ContactList
            v-if="panelTab === 'tracks'"
            v-model:hidden="hidden"
            v-model:filter="contactFilter"
            class="history-panel-content"
            :rows="contactRows"
            kinds
            :can-delete="canDelete"
            empty-text="No recorded positions in this range."
            @focus="focus"
            @delete="deleting = $event"
          />
          <HistoryAnalysis
            v-else
            v-model:coverage="coverage"
            v-model:cell-metres="cellMetres"
            v-model:area-id="areaId"
            class="history-panel-content history-panel-scroll"
            :tracks="shown.map(({ track }) => track)"
            :objects="objects"
          />
        </v-sheet>
      </main>
      <HistoryTimeline v-if="span !== null" v-model:cursor="cursor" v-model:trail-ms="trailMs" :start="span.start" :end="span.end" />
    </template>

    <ConfirmDialog
      :model-value="deleting !== null"
      title="Delete these recorded positions?"
      confirm-label="Delete"
      confirm-color="error"
      :loading="deleteBusy"
      @update:model-value="deleting = null"
      @confirm="confirmDelete"
    >
      All recorded positions of {{ deleting }} in this event are deleted now, also outside the loaded range. This cannot be undone.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.history-header {
  height: 64px;
  flex: none;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.history-body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.history-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
}

.history-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  /* No z-index: Vuetify menus open above the page only while the panel stays in its stacking layer. */
  display: flex;
  flex-direction: column;
  width: 340px;
  max-height: calc(100% - 32px);
  overflow: hidden;
}

/* The track list scrolls virtually and needs a fixed height to fill. */
.history-panel--tracks {
  height: calc(100% - 32px);
}

.history-panel-content {
  flex: 1;
  min-height: 0;
}

.history-panel-scroll {
  overflow-y: auto;
}

@media (max-width: 599px) {
  .history-panel {
    left: 76px;
    width: auto;
    max-height: 45%;
  }
}
</style>
