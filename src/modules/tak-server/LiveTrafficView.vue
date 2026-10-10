<script setup lang="ts">
import { DEFAULT_GRID_SETTINGS } from "@/modules/editor/map/mgrs-grid";
import { mdiArrowLeft, mdiMapClock } from "@mdi/js";
import type { Socket } from "socket.io-client";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { connectRealtime } from "@/shared/realtime/realtime";
import { useSession } from "@/modules/auth/session";
import EditorToolbar from "@/modules/editor/components/EditorToolbar.vue";
import PackageMapView from "@/modules/editor/components/PackageMapView.vue";
import ContactList from "./contacts/ContactList.vue";
import { DEFAULT_FILTER, type ContactFilter, type ContactRow } from "./contacts/contact-list";
import type { LiveTakItemDto, LiveTakTrafficDto } from "./tak-server.api";
import { useEventMapContent } from "./useEventMapContent";

/**
 * Read-only event map with the live TAK traffic of the built-in server on top: the event's Data
 * Packages as in the editor, plus current positions and markers pushed by Core as they change.
 * Nothing here edits; users without access to the packages still see the live layer.
 */
const route = useRoute();
const router = useRouter();
const session = useSession();
const eventId = String(route.params.eventId);

const { layers: mapLayers, objects, contents, load: loadPackages } = useEventMapContent(eventId);
const traffic = ref<LiveTakTrafficDto>({ connections: [], items: [] });
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const connectionsOpen = ref(true);
const connected = ref(false);
let socket: Socket | null = null;

const now = ref(Date.now());
const clock = window.setInterval(() => (now.value = Date.now()), 5000);
/** A position older than this counts as "not heard from" in the list. */
const STALE_AFTER_MS = 2 * 60_000;
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

const hidden = ref(new Set<string>());
const contactFilter = ref<ContactFilter>({ ...DEFAULT_FILTER });

/** Items by callsign, built once per snapshot instead of searched for every list row. */
const itemsByCallsign = computed(() => {
  const index = new Map<string, LiveTakItemDto>();
  for (const item of traffic.value.items) {
    if (item.callsign !== null) index.set(item.callsign, item);
  }
  return index;
});

/**
 * Apps hidden in the list disappear from the map with their own position. Markers they placed
 * stay, because the live data does not say who placed a marker.
 */
const liveItems = computed(() => {
  if (hidden.value.size === 0) return traffic.value.items;
  const hiddenCallsigns = new Set(
    traffic.value.connections.filter(({ id, callsign }) => callsign !== null && hidden.value.has(id)).map(({ callsign }) => callsign),
  );
  return traffic.value.items.filter((item) => item.callsign === null || !hiddenCallsigns.has(item.callsign));
});

const contactRows = computed<ContactRow[]>(() =>
  traffic.value.connections.map((connection) => {
    const label = connection.callsign ?? connection.userDisplayName;
    const item = connection.callsign === null ? undefined : itemsByCallsign.value.get(connection.callsign);
    // How long ago the app's own position was taken, from the position's own time.
    const ageMs = item === undefined ? null : Math.max(0, now.value - Date.parse(item.time));
    return {
      key: connection.id,
      label,
      group: connection.eventGroup?.name ?? null,
      color: null,
      ageMs,
      stale: ageMs !== null && ageMs > STALE_AFTER_MS,
      device: true,
      details: [
        [connection.userDisplayName, connection.eventRole?.name].filter(Boolean).join(" · "),
        `Connected since ${timeFormat.format(new Date(connection.connectedAt))}`,
      ],
      searchText: `${connection.userDisplayName} ${connection.eventRole?.name ?? ""}`,
    };
  }),
);

function focus(connectionId: string): void {
  const callsign = traffic.value.connections.find(({ id }) => id === connectionId)?.callsign;
  const uid = callsign === null || callsign === undefined ? undefined : itemsByCallsign.value.get(callsign)?.uid;
  if (uid !== undefined) mapView.value?.zoomToLive(uid);
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
      <v-btn v-if="session.can('tak-traffic.history', eventId)" :to="{ name: 'event-history', params: { eventId } }" variant="text" size="small" :prepend-icon="mdiMapClock">History</v-btn>
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
        <div class="d-flex align-center px-4 pt-3">
          <div class="text-title-small flex-grow-1">Connected apps</div>
          <span class="text-body-small text-medium-emphasis">{{ traffic.connections.length }}</span>
        </div>
        <ContactList
          v-model:hidden="hidden"
          v-model:filter="contactFilter"
          class="live-panel-content"
          :rows="contactRows"
          without-position
          empty-text="No TAK app of this event is connected."
          @focus="focus"
        />
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
  /* No z-index: Vuetify menus open above the page only while the panel stays in its stacking layer. */
  display: flex;
  flex-direction: column;
  width: 340px;
  max-height: calc(100% - 32px);
  overflow: hidden;
}

/* The contact list scrolls virtually and needs a fixed height to fill. */
.live-panel {
  height: calc(100% - 32px);
}

.live-panel-content {
  flex: 1;
  min-height: 0;
}

@media (max-width: 599px) {
  .live-panel {
    left: 76px;
    width: auto;
    max-height: 40%;
  }
}
</style>
