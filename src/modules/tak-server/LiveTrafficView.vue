<script setup lang="ts">
import { DEFAULT_GRID_SETTINGS } from "@/modules/editor/map/mgrs-grid";
import { mdiArrowLeft, mdiCrosshairsGps, mdiMapClock } from "@mdi/js";
import type { Socket } from "socket.io-client";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { connectRealtime } from "@/shared/realtime/realtime";
import EditorToolbar from "@/modules/editor/components/EditorToolbar.vue";
import PackageMapView from "@/modules/editor/components/PackageMapView.vue";
import { formatAge } from "./history/track-timeline";
import type { LiveTakTrafficDto } from "./tak-server.api";
import { useEventMapContent } from "./useEventMapContent";

/**
 * Read-only event map with the live TAK traffic of the built-in server on top: the event's Data
 * Packages as in the editor, plus current positions and markers pushed by Core as they change.
 * Nothing here edits; users without access to the packages still see the live layer.
 */
const route = useRoute();
const router = useRouter();
const eventId = String(route.params.eventId);

const { layers: mapLayers, objects, contents, load: loadPackages } = useEventMapContent(eventId);
const traffic = ref<LiveTakTrafficDto>({ connections: [], items: [] });
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const connectionsOpen = ref(true);
const connected = ref(false);
let socket: Socket | null = null;

const liveItems = computed(() => traffic.value.items);
const now = ref(Date.now());
const clock = window.setInterval(() => (now.value = Date.now()), 5000);

/** How long ago the app's own position was taken, from the position's own time. */
function positionAge(callsign: string | null): string | null {
  const item = traffic.value.items.find((candidate) => candidate.callsign !== null && candidate.callsign === callsign);
  return item === undefined ? null : `position ${formatAge(now.value - Date.parse(item.time))} old`;
}

function itemOf(callsign: string | null): string | null {
  return traffic.value.items.find((item) => item.callsign !== null && item.callsign === callsign)?.uid ?? null;
}

/** Core sends a full snapshot on connect and whenever the event's traffic changes. */
function watchTraffic(): void {
  socket = connectRealtime("/tak-traffic", { eventId });
  socket.on("traffic", (snapshot: LiveTakTrafficDto) => {
    traffic.value = snapshot;
  });
  socket.on("connect", () => {
    connected.value = true;
  });
  socket.on("disconnect", () => {
    connected.value = false;
  });
  socket.on("connect_error", (connectError: Error) => {
    connected.value = false;
    if (connectError.message === "Access denied") {
      error.value = "You cannot watch the live TAK traffic of this event.";
      state.value = "error";
      socket?.disconnect();
    }
  });
}

onMounted(async () => {
  try {
    watchTraffic();
    await loadPackages();
    if (state.value !== "error") {
      state.value = "ready";
    }
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
});

onBeforeUnmount(() => {
  socket?.disconnect();
  window.clearInterval(clock);
});
</script>

<template>
  <div class="live-view">
    <header class="live-header d-flex align-center ga-3 px-4">
      <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Back to the event" @click="router.push({ name: 'event-detail', params: { eventId } })" />
      <div class="flex-grow-1">
        <div class="text-title-medium font-weight-medium">Live TAK traffic</div>
        <div class="text-body-small text-medium-emphasis">
          {{ traffic.connections.length }} connected · {{ traffic.items.length }} items · {{ connected ? "live" : "reconnecting…" }}
        </div>
      </div>
      <v-btn :to="{ name: 'event-history', params: { eventId } }" variant="text" size="small" :prepend-icon="mdiMapClock">History</v-btn>
    </header>

    <ErrorState v-if="state === 'error'" :message="error" class="ma-6" />
    <v-skeleton-loader v-else-if="state === 'loading'" type="image" class="ma-6" />
    <main v-else class="live-body">
      <PackageMapView ref="mapView" :layers="mapLayers" :objects="objects" :contents="contents" :live="liveItems" :selected-id="null" tool="select" />

      <EditorToolbar
        tool="select"
        view-only
        :editable="false"
        :can-undo="false"
        :can-redo="false"
        :layers-open="connectionsOpen"
        layers-label="connected apps"
        :base-maps="mapView?.baseMaps ?? []"
        :base-map-id="mapView?.activeBaseMapId ?? ''"
        class="live-toolbar"
        :grid-visible="mapView?.gridVisible ?? false"
        :grid-settings="mapView?.gridSettings ?? DEFAULT_GRID_SETTINGS"
        @toggle-layers="connectionsOpen = !connectionsOpen"
        @change-base-map="mapView?.selectBaseMap($event)"
        @fit="mapView?.fitToContent()"
        @toggle-grid="mapView?.setGridVisible(!(mapView?.gridVisible ?? false))"
        @change-grid-settings="mapView?.setGridSettings($event)"
      />

      <v-sheet v-if="connectionsOpen" elevation="4" rounded="lg" class="live-panel">
        <div class="d-flex align-center px-3 pt-3 pb-1">
          <div class="text-title-small flex-grow-1">Connected apps</div>
          <span class="text-body-small text-medium-emphasis">{{ traffic.connections.length }}</span>
        </div>
        <p v-if="traffic.connections.length === 0" class="text-body-medium text-medium-emphasis px-3 pb-3 my-0">
          No TAK app of this event is connected.
        </p>
        <v-list v-else density="compact" lines="two" slim class="pa-1">
          <v-list-item
            v-for="connection in traffic.connections"
            :key="connection.id"
            rounded="md"
            :title="connection.callsign ?? connection.userDisplayName"
            :subtitle="itemOf(connection.callsign)
              ? `${connection.userDisplayName} · ${positionAge(connection.callsign)}`
              : `${connection.userDisplayName} · no position yet`"
            :disabled="!itemOf(connection.callsign)"
            :prepend-icon="mdiCrosshairsGps"
            @click="mapView?.zoomToLive(itemOf(connection.callsign) ?? '')"
          />
        </v-list>
      </v-sheet>
    </main>
  </div>
</template>

<style scoped>
.live-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.live-header {
  height: 64px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.live-body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.live-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
}

.live-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1;
  width: 300px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
}

@media (max-width: 599px) {
  .live-panel {
    left: 76px;
    width: auto;
    max-height: 40%;
  }
}
</style>
