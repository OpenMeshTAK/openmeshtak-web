<script setup lang="ts">
import { mdiArrowLeft, mdiFitToPageOutline } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import CreatePackageCopyDialog from "@/modules/data-packages/components/CreatePackageCopyDialog.vue";
import {
  listDataPackages,
  listLayers,
  listObjects,
  type DataPackageDto,
  type PackageLayerDto,
} from "@/modules/data-packages/data-packages.api";
import { getEvent, type EventDto } from "@/modules/events/events.api";
import EventPackageTree from "./components/EventPackageTree.vue";
import PackageMapView from "./components/PackageMapView.vue";
import type { EventPackageBranch } from "./event-editor.types";

const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();
const eventId = String(route.params.eventId);

const event = ref<EventDto | null>(null);
const branches = ref<EventPackageBranch[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const selectedId = ref<string | null>(null);
const mapView = ref<InstanceType<typeof PackageMapView> | null>(null);
const copySource = ref<{ branch: EventPackageBranch; layer: PackageLayerDto } | null>(null);
const copyOpen = ref(false);

const layers = computed(() => branches.value.flatMap(({ layers }) => layers));
// The event-wide view selects and inspects content; package-specific editors own mutations.
const mapLayers = computed(() => layers.value.map((layer) => ({ ...layer, locked: true })));
const objects = computed(() => branches.value.flatMap(({ objects }) => objects));
const selected = computed(() => objects.value.find(({ id }) => id === selectedId.value) ?? null);
const selectedBranch = computed(() =>
  selected.value === null ? null : branches.value.find(({ dataPackage }) => dataPackage.id === selected.value?.packageId) ?? null,
);
const selectedLayer = computed(() =>
  selected.value === null ? null : layers.value.find(({ id }) => id === selected.value?.layerId) ?? null,
);
const canCopy = computed(
  () => event.value?.status !== "archived" && session.can("data-packages.edit", eventId),
);

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedEvent, packages] = await Promise.all([getEvent(eventId), listDataPackages(eventId)]);
    event.value = loadedEvent;
    branches.value = await Promise.all(
      packages.map(async (dataPackage) => {
        const path = { eventId, packageId: dataPackage.id };
        const [packageLayers, packageObjects] = await Promise.all([listLayers(path), listObjects(path)]);
        return { dataPackage, layers: packageLayers, objects: packageObjects };
      }),
    );
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

function openPackage(packageId: string): void {
  void router.push({ name: "package-editor", params: { eventId, packageId } });
}

function toggleLayer(layer: PackageLayerDto): void {
  branches.value = branches.value.map((branch) => ({
    ...branch,
    layers: branch.layers.map((candidate) =>
      candidate.id === layer.id ? { ...candidate, visible: !candidate.visible } : candidate,
    ),
  }));
}

function copyLayer(branch: EventPackageBranch, layer: PackageLayerDto): void {
  copySource.value = { branch, layer };
  copyOpen.value = true;
}

function openCopiedPackage(created: DataPackageDto): void {
  toast.success(`Editable data package ${created.name} was created.`);
  openPackage(created.id);
}

onMounted(load);
</script>

<template>
  <div class="event-editor-shell">
    <header class="event-editor-header d-flex align-center ga-3 px-4 py-2">
      <v-btn
        :icon="mdiArrowLeft"
        variant="text"
        aria-label="Back to the event"
        :to="{ name: 'event-detail', params: { eventId } }"
      />
      <div class="flex-grow-1" style="min-width: 0">
        <div class="text-h6 text-truncate">{{ event?.name ?? "Event" }} map</div>
        <div class="text-caption text-medium-emphasis">
          {{ branches.length }} data packages · {{ layers.length }} layers · {{ objects.length }} items
        </div>
      </div>
      <v-btn variant="text" :prepend-icon="mdiFitToPageOutline" @click="mapView?.fitToContent()">Fit content</v-btn>
    </header>

    <v-progress-linear v-if="state === 'loading'" indeterminate />
    <ErrorState v-else-if="state === 'error'" class="ma-6" :message="error" @retry="load" />
    <EmptyState
      v-else-if="branches.length === 0"
      class="ma-6"
      title="No data packages"
      text="Create a data package before opening the event map."
    />

    <main v-else class="event-editor-body">
      <PackageMapView
        ref="mapView"
        :layers="mapLayers"
        :objects="objects"
        :selected-id="selectedId"
        tool="select"
        @select="selectedId = $event"
      />

      <v-sheet elevation="4" rounded="lg" class="event-editor-tree">
        <EventPackageTree
          :branches="branches"
          :selected-id="selectedId"
          :can-copy="canCopy"
          @select="selectedId = $event"
          @open-package="openPackage"
          @toggle-layer="toggleLayer"
          @copy-layer="copyLayer"
        />
      </v-sheet>

      <v-sheet v-if="selected && selectedBranch && selectedLayer" elevation="4" rounded="lg" class="event-editor-selection pa-4">
        <div class="text-overline text-medium-emphasis">Selected item</div>
        <div class="text-subtitle-1 font-weight-medium">{{ selected.name }}</div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ selectedBranch.dataPackage.name }} → {{ selectedLayer.name }}
        </div>
        <v-btn size="small" variant="tonal" @click="openPackage(selectedBranch.dataPackage.id)">Open data package</v-btn>
      </v-sheet>
    </main>

    <CreatePackageCopyDialog
      v-if="copySource"
      v-model="copyOpen"
      :event-id="eventId"
      :default-name="`${copySource.branch.dataPackage.name} - ${copySource.layer.name}`"
      :source-label="`layer ${copySource.layer.name}`"
      :selection="[{ packageId: copySource.branch.dataPackage.id, layerIds: [copySource.layer.id] }]"
      @created="openCopiedPackage"
    />
  </div>
</template>

<style scoped>
.event-editor-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.event-editor-header {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.event-editor-body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.event-editor-tree,
.event-editor-selection {
  position: absolute;
  top: 12px;
  bottom: 12px;
  z-index: 1;
  overflow-y: auto;
}
.event-editor-tree {
  left: 12px;
  width: 360px;
}
.event-editor-selection {
  right: 12px;
  bottom: auto;
  width: 300px;
}
@media (max-width: 1100px) {
  .event-editor-tree {
    width: 300px;
  }
  .event-editor-selection {
    width: 260px;
  }
}
</style>
