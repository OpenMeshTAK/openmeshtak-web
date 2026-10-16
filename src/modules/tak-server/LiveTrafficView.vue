<script setup lang="ts">
import { readLiveLabels, storeLiveLabels } from "@/modules/editor/editor-preferences";
import type { LiveLabelMode } from "@/modules/editor/map/live-layer";
import { DEFAULT_GRID_SETTINGS } from "@/modules/editor/map/mgrs-grid";
import { mdiArrowLeft, mdiMapClock } from "@mdi/js";
import type { Socket } from "socket.io-client";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { connectRealtime } from "@/shared/realtime/realtime";
import { useSession } from "@/modules/auth/session";
import EditorToolbar from "@/modules/editor/components/EditorToolbar.vue";
import PackageMapView from "@/modules/editor/components/PackageMapView.vue";
import ContactList from "./contacts/ContactList.vue";
import { DEFAULT_FILTER, UNKNOWN_MESH_GROUP, type ContactFilter, type ContactRow } from "./contacts/contact-list";
import { itemsByContact, meshProvenance, newestItem, UNBOUND_MESH_PREFIX, visibleItems } from "./contacts/live-contacts";
import type { LiveTakConnectionDto, LiveTakItemDto, LiveTakTrafficDto } from "./tak-server.api";
import { applyTrafficChanges, type LiveTakTrafficChanges } from "./live-traffic-changes";
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
// Each update replaces the whole snapshot; deep reactivity over hundreds of items would only cost time.
const traffic = shallowRef<LiveTakTrafficDto>({ connections: [], items: [] });
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
/** With many contacts, labels by default only appear once zoomed in; the selected item keeps its label. */
const liveLabels = ref<LiveLabelMode>(readLiveLabels());
const selectedUid = ref<string | null>(null);

function setLiveLabels(mode: LiveLabelMode): void {
  liveLabels.value = mode;
  storeLiveLabels(mode);
}
const contactFilter = ref<ContactFilter>({ ...DEFAULT_FILTER });

/** Items by their contact row, built once per update instead of searched for every list row. */
const byContact = computed(() => itemsByContact(traffic.value.connections, traffic.value.items));

/** Contacts hidden in the list leave the map with their own position and the markers they placed. */
const liveItems = computed(() => (hidden.value.size === 0 ? traffic.value.items : visibleItems(byContact.value, hidden.value)));

function ageOf(item: LiveTakItemDto | undefined): number | null {
  // How long ago the position was taken, from the item's own time.
  return item === undefined ? null : Math.max(0, now.value - Date.parse(item.time));
}

function countText(count: number): string {
  return count === 1 ? "1 item on the map" : `${String(count)} items on the map`;
}

/** The app's own position: the item it sent under its own callsign. */
function ownPosition(connection: LiveTakConnectionDto): LiveTakItemDto | undefined {
  if (connection.callsign === null) return undefined;
  return byContact.value.get(connection.id)?.find((item) => item.callsign === connection.callsign);
}

const connectionRows = computed<ContactRow[]>(() =>
  traffic.value.connections.map((connection) => {
    const ageMs = ageOf(ownPosition(connection));
    return {
      key: connection.id,
      label: connection.callsign ?? connection.userDisplayName,
      group: connection.eventGroup?.name ?? null,
      color: null,
      ageMs,
      stale: ageMs !== null && ageMs > STALE_AFTER_MS,
      device: true,
      details: [
        [connection.userDisplayName, connection.eventRole?.name].filter(Boolean).join(" · "),
        `Connected since ${timeFormat.format(new Date(connection.connectedAt))}`,
        countText(byContact.value.get(connection.id)?.length ?? 0),
      ],
      searchText: `${connection.userDisplayName} ${connection.eventRole?.name ?? ""}`,
    };
  }),
);

/**
 * Members without a connected app whose positions or markers are still current: their app
 * disconnected, or their bound Meshtastic node reaches Core through an HQ uplink.
 */
const disconnectedRows = computed<ContactRow[]>(() =>
  [...byContact.value]
    .filter(([key]) => key.startsWith("user:"))
    .map(([key, items]) => {
      const newest = newestItem(items);
      const sender = newest?.placedBy;
      const ageMs = ageOf(newest);
      const mesh = newest?.mesh;
      return {
        key,
        label: sender?.userDisplayName ?? "Unknown user",
        group: sender?.eventGroup?.name ?? null,
        color: null,
        ageMs,
        stale: ageMs !== null && ageMs > STALE_AFTER_MS,
        device: mesh !== undefined,
        details: ["No TAK app connected", ...(mesh === undefined ? [] : meshProvenance(mesh)), countText(items.length)],
        searchText: mesh === undefined ? "" : `${mesh.nodeId} ${mesh.shortName ?? ""} ${mesh.longName ?? ""}`,
      };
    }),
);

/** Meshtastic nodes no member is bound to: listed apart and named by what the node announced. */
const unboundMeshRows = computed<ContactRow[]>(() =>
  [...byContact.value]
    .filter(([key]) => key.startsWith(UNBOUND_MESH_PREFIX))
    .map(([key, items]) => {
      const newest = newestItem(items);
      const mesh = newest?.mesh;
      const ageMs = ageOf(newest);
      return {
        key,
        label: mesh?.longName ?? mesh?.shortName ?? mesh?.nodeId ?? key.slice(UNBOUND_MESH_PREFIX.length),
        group: UNKNOWN_MESH_GROUP,
        color: null,
        ageMs,
        stale: ageMs !== null && ageMs > STALE_AFTER_MS,
        device: true,
        details: ["Unknown node, not bound to a member", ...(mesh === undefined ? [] : meshProvenance(mesh))],
        searchText: mesh === undefined ? "" : `${mesh.nodeId} ${mesh.shortName ?? ""}`,
      };
    }),
);

/** Positions an HQ uplinked from its Meshtastic radio. */
const meshCount = computed(() => traffic.value.items.filter(({ source }) => source === "mesh").length);

const contactRows = computed(() => [...connectionRows.value, ...disconnectedRows.value, ...unboundMeshRows.value]);

function focus(key: string): void {
  const connection = traffic.value.connections.find(({ id }) => id === key);
  const item = connection === undefined ? newestItem(byContact.value.get(key) ?? []) : ownPosition(connection);
  if (item === undefined) return;
  selectedUid.value = item.uid;
  mapView.value?.zoomToLive(item.uid);
}

/** Core sends a full snapshot on connect and afterwards only what changed. */
function watchTraffic(): void {
  socket = connectRealtime("/tak-traffic", { eventId });
  socket.on("traffic", (snapshot: LiveTakTrafficDto) => {
    traffic.value = snapshot;
  });
  socket.on("traffic-changes", (changes: LiveTakTrafficChanges) => {
    traffic.value = applyTrafficChanges(traffic.value, changes);
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
          {{ traffic.connections.length }} connected · {{ traffic.items.length }} items<template v-if="meshCount > 0"> ({{ meshCount }} via Meshtastic)</template> · {{ connected ? "live" : "reconnecting…" }}
        </div>
      </div>
      <v-btn v-if="session.can('tak-traffic.history', eventId)" :to="{ name: 'event-history', params: { eventId } }" variant="text" size="small" :prepend-icon="mdiMapClock">History</v-btn>
    </header>

    <ErrorState v-if="state === 'error'" :message="error" class="ma-6" />
    <v-skeleton-loader v-else-if="state === 'loading'" type="image" class="ma-6" />
    <main v-else class="live-body">
      <PackageMapView
        ref="mapView"
        :layers="mapLayers"
        :objects="objects"
        :contents="contents"
        :live="liveItems"
        :live-labels="liveLabels"
        live-selectable
        :live-selected-id="selectedUid"
        :selected-id="null"
        tool="select"
        @select-live="selectedUid = $event"
      />

      <EditorToolbar
        tool="select"
        view-only
        :editable="false"
        :can-undo="false"
        :can-redo="false"
        :layers-open="connectionsOpen"
        layers-label="contacts"
        :base-maps="mapView?.baseMaps ?? []"
        :base-map-id="mapView?.activeBaseMapId ?? ''"
        class="live-toolbar"
        :grid-visible="mapView?.gridVisible ?? false"
        :grid-settings="mapView?.gridSettings ?? DEFAULT_GRID_SETTINGS"
        :live-labels="liveLabels"
        @change-live-labels="setLiveLabels"
        @toggle-layers="connectionsOpen = !connectionsOpen"
        @change-base-map="mapView?.selectBaseMap($event)"
        @fit="mapView?.fitToContent()"
        @toggle-grid="mapView?.setGridVisible(!(mapView?.gridVisible ?? false))"
        @change-grid-settings="mapView?.setGridSettings($event)"
      />

      <v-sheet v-if="connectionsOpen" elevation="4" rounded="lg" class="live-panel">
        <div class="d-flex align-center px-4 pt-3">
          <div class="text-title-small flex-grow-1">Contacts</div>
          <span class="text-body-small text-medium-emphasis">{{ traffic.connections.length }} connected</span>
        </div>
        <ContactList
          v-model:hidden="hidden"
          v-model:filter="contactFilter"
          class="live-panel-content"
          :rows="contactRows"
          without-position
          empty-text="No TAK app of this event is connected and nothing is on the map."
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
