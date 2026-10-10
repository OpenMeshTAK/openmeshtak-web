<script setup lang="ts">
import { DEFAULT_GRID_SETTINGS } from "@/modules/editor/map/mgrs-grid";
import { mdiArrowLeft, mdiClipboardCheckOutline, mdiFullscreen, mdiFullscreenExit, mdiUsb, mdiWifiOff } from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import EditorToolbar from "@/modules/editor/components/EditorToolbar.vue";
import PackageMapView from "@/modules/editor/components/PackageMapView.vue";
import type { EditorTool } from "@/modules/editor/map/package-map";
import { formatAge } from "./format-age";
import { isStale, nodeLabel, type MeshNode } from "./meshtastic/mesh-nodes";
import { useMeshRadio } from "./meshtastic/useMeshRadio";
import { hasOfflineBasemap, offlineMapData, type OfflineMapData } from "./offline-map-data";
import { readSnapshot, type StoredSnapshot } from "./offline-store";
import ReadinessPanel from "./ReadinessPanel.vue";
import { useNetworkState } from "./useNetworkState";

/**
 * Offline HQ live view: the event's stored published Data Packages on the shared map, plus the
 * Meshtastic nodes a USB-connected radio hears. It makes no request to Core or any tile provider,
 * so it works the same with and without a network.
 */
const route = useRoute();
const router = useRouter();
const eventId = String(route.params.eventId);

const record = shallowRef<StoredSnapshot | null>(null);
const mapData = shallowRef<OfflineMapData>({ layers: [], objects: [], contents: [], objectUrls: [] });
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const panelOpen = ref(true);
const readinessOpen = ref(false);
const tool = ref<EditorTool>("select");
const fullscreen = ref(false);
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const radio = useMeshRadio();
const { online } = useNetworkState();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const staleChoices = [5, 15, 30, 60, 120].map((minutes) => ({ title: `${String(minutes)} min`, value: minutes }));

/** Nodes with a position first, then by when they were last heard. */
const nodes = computed(() =>
  [...radio.nodes.value].sort((a, b) =>
    Number(b.position !== null) - Number(a.position !== null)
    || (b.lastHeardAt?.getTime() ?? 0) - (a.lastHeardAt?.getTime() ?? 0),
  ),
);
const positioned = computed(() => nodes.value.filter(({ position }) => position !== null).length);
const radioLabel = computed(() => ({ idle: "radio not connected", connecting: "connecting radio…", connected: "radio connected", disconnected: "radio disconnected" })[radio.status.value]);

function nodeSubtitle(node: MeshNode): string {
  const now = radio.now.value;
  const parts: string[] = [];
  if (node.position === null) {
    parts.push("no position available");
  } else if (node.positionAt === null) {
    parts.push("position of unknown age");
  } else {
    parts.push(`position ${formatAge(node.positionAt, now)}${isStale(node, now, radio.staleAfterMinutes.value * 60_000) ? " (stale)" : ""}`);
  }
  if (!node.heardLive) {
    parts.push("from the radio's node list");
  } else if (node.lastHeardAt !== null && node.lastHeardAt !== node.positionAt) {
    parts.push(`heard ${formatAge(node.lastHeardAt, now)}`);
  }
  if (node.batteryLevel !== null && node.batteryLevel > 0 && node.batteryLevel <= 100) {
    parts.push(`battery ${String(node.batteryLevel)} %`);
  }
  return parts.join(" · ");
}

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement === null) {
    await document.documentElement.requestFullscreen().catch(() => undefined);
  } else {
    await document.exitFullscreen().catch(() => undefined);
  }
}

function onFullscreenChange(): void {
  fullscreen.value = document.fullscreenElement !== null;
}

onMounted(async () => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  try {
    const stored = await readSnapshot(eventId);
    if (stored === null || !stored.complete) {
      error.value = "This event is not completely stored in this browser. Prepare it again while online.";
      state.value = "error";
      return;
    }
    record.value = stored;
    mapData.value = await offlineMapData(stored);
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = caught instanceof Error ? caught.message : "Offline data could not be read.";
    state.value = "error";
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  for (const url of mapData.value.objectUrls) URL.revokeObjectURL(url);
});
</script>

<template>
  <div class="offline-view">
    <header class="offline-header d-flex align-center ga-3 px-4">
      <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Back to offline events" @click="router.push({ name: 'offline-home' })" />
      <div class="flex-grow-1 min-width-0">
        <div class="text-title-medium font-weight-medium text-truncate">
          {{ record?.snapshot.event.name ?? "Offline HQ" }}
          <InfoHint
            v-if="record !== null && !hasOfflineBasemap(record)"
            tone="warning"
            label="No offline background map"
            text="The stored packages contain no offline map. Drawings and positions appear on a blank background."
          />
        </div>
        <div class="text-body-small text-medium-emphasis text-truncate">
          {{ positioned }} of {{ nodes.length }} nodes with position · {{ radioLabel }}
          <template v-if="record !== null"> · stored {{ dateFormat.format(new Date(record.storedAt)) }}</template>
        </div>
      </div>
      <v-chip v-if="!online" :prepend-icon="mdiWifiOff" size="small" variant="tonal">No network</v-chip>
      <v-btn :icon="mdiClipboardCheckOutline" variant="text" aria-label="Check offline readiness" title="Check offline readiness" @click="readinessOpen = true" />
      <v-btn
        :icon="fullscreen ? mdiFullscreenExit : mdiFullscreen"
        variant="text"
        :aria-label="fullscreen ? 'Leave full screen' : 'Full screen'"
        :title="fullscreen ? 'Leave full screen' : 'Full screen'"
        @click="toggleFullscreen"
      />
    </header>

    <ErrorState v-if="state === 'error'" :message="error" class="ma-6" @retry="router.go(0)" />
    <v-skeleton-loader v-else-if="state === 'loading'" type="image" class="ma-6" />
    <main v-else class="offline-body">
      <PackageMapView
        ref="mapView"
        offline
        :layers="mapData.layers"
        :objects="mapData.objects"
        :contents="mapData.contents"
        :live="radio.liveItems.value"
        :selected-id="null"
        :tool="tool"
      />

      <EditorToolbar
        v-model:tool="tool"
        view-only
        :editable="false"
        :can-undo="false"
        :can-redo="false"
        :layers-open="panelOpen"
        layers-label="radio and nodes"
        class="offline-toolbar"
        :grid-visible="mapView?.gridVisible ?? false"
        :grid-settings="mapView?.gridSettings ?? DEFAULT_GRID_SETTINGS"
        @toggle-layers="panelOpen = !panelOpen"
        @fit="mapView?.fitToContent()"
        @clear-measurements="mapView?.clearMeasurements()"
        @toggle-grid="mapView?.setGridVisible(!(mapView?.gridVisible ?? false))"
        @change-grid-settings="mapView?.setGridSettings($event)"
      />

      <v-sheet v-if="panelOpen" elevation="4" rounded="lg" class="offline-panel">
        <div class="d-flex align-center px-3 pt-3 pb-1">
          <div class="text-title-small flex-grow-1">
            USB radio
            <InfoHint text="The radio only reports nodes whose packets reach it on its own channels. The app reads what the radio receives and never changes its settings." />
          </div>
        </div>
        <div class="px-3 pb-3">
          <v-alert v-if="!radio.supported" type="error" density="compact" class="mb-2">
            This browser cannot connect USB radios. Use a current Chrome or Edge on Windows or Linux.
          </v-alert>
          <v-alert v-else-if="radio.message.value !== null" type="error" density="compact" class="mb-2">
            {{ radio.message.value }}
          </v-alert>
          <div class="d-flex flex-wrap ga-2">
            <template v-if="radio.status.value === 'connected' || radio.status.value === 'connecting'">
              <v-btn size="small" variant="tonal" :loading="radio.status.value === 'connecting'" @click="radio.disconnect()">Disconnect</v-btn>
            </template>
            <template v-else>
              <v-btn size="small" color="primary" :prepend-icon="mdiUsb" :disabled="!radio.supported" @click="radio.connect()">Connect radio</v-btn>
              <v-btn v-if="radio.status.value === 'disconnected'" size="small" variant="tonal" @click="radio.reconnect()">Reconnect</v-btn>
            </template>
          </div>
          <v-select
            v-model="radio.staleAfterMinutes.value"
            :items="staleChoices"
            label="Stale after"
            density="compact"
            hide-details
            class="mt-3"
          />
          <p v-if="radio.counters.value.undecodable + radio.counters.value.invalid > 0" class="text-body-small text-medium-emphasis mt-2 mb-0">
            {{ radio.counters.value.undecodable + radio.counters.value.invalid }} damaged radio frames ignored.
          </p>
        </div>
        <v-divider />
        <div class="d-flex align-center px-3 pt-3 pb-1">
          <div class="text-title-small flex-grow-1">
            Mesh nodes
            <InfoHint text="Squares on the map are Meshtastic nodes heard by this radio, not TAK markers. Grey dashed squares are stale: their last position is older than the chosen time or of unknown age." />
          </div>
          <span class="text-body-small text-medium-emphasis">{{ nodes.length }}</span>
        </div>
        <p v-if="nodes.length === 0" class="text-body-medium text-medium-emphasis px-3 pb-3 my-0">
          No nodes yet. Connect the radio to see the nodes it hears.
        </p>
        <v-list v-else density="compact" lines="two" slim class="pa-1">
          <v-list-item
            v-for="node in nodes"
            :key="node.num"
            rounded="md"
            :title="node.isOwnRadio ? `${nodeLabel(node)} (this radio)` : nodeLabel(node)"
            :subtitle="nodeSubtitle(node)"
            :disabled="node.position === null"
            @click="mapView?.zoomToLive(`mesh:${node.id}`)"
          />
        </v-list>
      </v-sheet>
    </main>

    <v-dialog v-model="readinessOpen" max-width="560" scrollable>
      <v-card>
        <v-card-title class="text-title-large">Offline readiness</v-card-title>
        <v-card-text>
          <ReadinessPanel :event-id="eventId" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="readinessOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.offline-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.offline-header {
  height: 64px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.min-width-0 {
  min-width: 0;
}

.offline-body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.offline-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
}

.offline-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1;
  width: 320px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
}

@media (max-width: 599px) {
  .offline-panel {
    left: 76px;
    width: auto;
    max-height: 45%;
  }
}
</style>
