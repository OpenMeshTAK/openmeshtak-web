<script setup lang="ts">
import { mdiArrowLeft, mdiCrosshairsGps } from "@mdi/js";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { listDataPackages } from "@/modules/data-packages/data-packages.api";
import { topFirst } from "@/modules/data-packages/package-order";
import PackageMapView from "@/modules/editor/components/PackageMapView.vue";
import { mapContentItems } from "@/modules/editor/map/map-content";
import { usePackageEditor, type PackageEditor } from "@/modules/editor/usePackageEditor";
import { getLiveTakTraffic, type LiveTakTrafficDto } from "./tak-server.api";

/**
 * Read-only event map with the live TAK traffic of the built-in server on top: the event's Data
 * Packages as in the editor, plus current positions and markers, refreshed every few seconds.
 * Nothing here edits; users without access to the packages still see the live layer.
 */
const REFRESH_MS = 3000;

const route = useRoute();
const router = useRouter();
const eventId = String(route.params.eventId);

const editors = shallowRef<PackageEditor[]>([]);
const traffic = ref<LiveTakTrafficDto>({ connections: [], items: [] });
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

const ordered = computed(() => {
  const loaded = editors.value.flatMap((editor) => (editor.dataPackage.value === null ? [] : [{ editor, dataPackage: editor.dataPackage.value }]));
  const order = topFirst(loaded.map(({ dataPackage }) => dataPackage)).map(({ id }) => id);
  return loaded.sort((a, b) => order.indexOf(a.dataPackage.id) - order.indexOf(b.dataPackage.id));
});
/** Same drawing order as the event editor: the top package of the list is drawn last. */
const mapLayers = computed(() =>
  [...ordered.value]
    .reverse()
    .flatMap(({ editor }) => editor.sortedLayers.value)
    .map((layer, sortOrder) => ({ ...layer, sortOrder })),
);
const objects = computed(() => ordered.value.flatMap(({ editor }) => editor.objects.value));
const contents = computed(() => editors.value.flatMap((editor) => mapContentItems(editor.path, editor.contents.value)));
const liveItems = computed(() => traffic.value.items);
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" });

function itemOf(callsign: string | null): string | null {
  return traffic.value.items.find((item) => item.callsign !== null && item.callsign === callsign)?.uid ?? null;
}

/** Packages are optional context: without `data-packages.read` the view shows only live traffic. */
async function loadPackages(): Promise<void> {
  try {
    const packages = await listDataPackages(eventId);
    const loaded = await Promise.all(
      packages.map(async ({ id }) => {
        const editor = usePackageEditor(eventId, id);
        await editor.load();
        return editor;
      }),
    );
    editors.value = loaded.filter(({ loadState }) => loadState.value !== "error");
  } catch (caught: unknown) {
    if (!isApiProblem(caught, "FORBIDDEN")) {
      throw caught;
    }
  }
}

async function refresh(): Promise<void> {
  try {
    traffic.value = await getLiveTakTraffic(eventId);
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
    clearInterval(timer);
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadPackages(), refresh()]);
    if (state.value !== "error") {
      state.value = "ready";
      timer = setInterval(() => void refresh(), REFRESH_MS);
    }
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="live-view">
    <header class="live-header d-flex align-center ga-3 px-4">
      <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Back to the event" @click="router.push({ name: 'event-detail', params: { eventId } })" />
      <div class="flex-grow-1">
        <div class="text-subtitle-1 font-weight-medium">Live TAK traffic</div>
        <div class="text-caption text-medium-emphasis">
          {{ traffic.connections.length }} connected · {{ traffic.items.length }} items · refreshes every {{ REFRESH_MS / 1000 }} s
        </div>
      </div>
    </header>

    <ErrorState v-if="state === 'error'" :message="error" class="ma-6" />
    <v-skeleton-loader v-else-if="state === 'loading'" type="image" class="ma-6" />
    <main v-else class="live-body">
      <PackageMapView ref="mapView" :layers="mapLayers" :objects="objects" :contents="contents" :live="liveItems" :selected-id="null" tool="select" />

      <v-sheet elevation="4" rounded="lg" class="live-panel">
        <div class="text-subtitle-2 pa-3 pb-1">Connected apps</div>
        <p v-if="traffic.connections.length === 0" class="text-body-2 text-medium-emphasis px-3 pb-3 mb-0">
          No TAK app of this event is connected.
        </p>
        <v-list v-else density="compact" lines="two" class="pt-0">
          <v-list-item
            v-for="connection in traffic.connections"
            :key="connection.id"
            :title="connection.callsign ?? connection.userDisplayName"
            :subtitle="`${connection.userDisplayName} · last seen ${timeFormat.format(new Date(connection.lastSeenAt))}`"
          >
            <template #append>
              <v-btn
                v-if="itemOf(connection.callsign)"
                :icon="mdiCrosshairsGps"
                variant="text"
                size="small"
                :aria-label="`Show ${connection.callsign ?? ''} on the map`"
                @click="mapView?.zoomToLive(itemOf(connection.callsign) ?? '')"
              />
            </template>
          </v-list-item>
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

.live-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 300px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
}

@media (max-width: 599px) {
  .live-panel {
    right: 16px;
    width: auto;
    max-height: 40%;
  }
}
</style>
