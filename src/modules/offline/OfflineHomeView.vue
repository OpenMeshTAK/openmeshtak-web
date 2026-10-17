<script setup lang="ts">
import { mdiArrowLeft, mdiDeleteOutline, mdiMapMarkerRadiusOutline, mdiWifiOff } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import DataTable from "@/shared/components/DataTable.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useNetworkState } from "./useNetworkState";
import { clearEvent, listSnapshots, type StoredSnapshot } from "./offline-store";
import { storeUplinkEnabled } from "./uplink/hq-identity";
import { clearOutbox } from "./uplink/uplink-outbox";

/**
 * Entry point of the offline HQ: the events stored in this browser. Works without Core and
 * without a session, because everything shown here is local.
 */
const snapshots = ref<StoredSnapshot[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const clearing = ref<StoredSnapshot | null>(null);
const clearOpen = ref(false);
const { online } = useNetworkState();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

async function load(): Promise<void> {
  try {
    snapshots.value = (await listSnapshots()).sort((a, b) => a.snapshot.event.name.localeCompare(b.snapshot.event.name));
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = caught instanceof Error ? caught.message : "Offline data could not be read.";
    state.value = "error";
  }
}

const headers = [
  { title: "Event", key: "name", value: (record: StoredSnapshot) => record.snapshot.event.name },
  { title: "Packages", key: "packages", value: (record: StoredSnapshot) => record.snapshot.packages.length, align: "end" as const },
  { title: "Stored", key: "storedAt", searchable: false },
  { title: "State", key: "complete", value: (record: StoredSnapshot) => (record.complete ? "Stored" : "Incomplete") },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const },
];

function askClear(record: StoredSnapshot): void {
  clearing.value = record;
  clearOpen.value = true;
}

async function confirmClear(): Promise<void> {
  if (clearing.value !== null) {
    // Clearing an event also ends its uplink and deletes what was still waiting to be sent.
    storeUplinkEnabled(clearing.value.eventId, false);
    await Promise.all([clearEvent(clearing.value.eventId), clearOutbox(clearing.value.eventId)]);
  }
  clearOpen.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <v-main>
    <v-container fluid class="pt-3 pb-6 px-6">
      <ViewHeader title="Offline HQ" subtitle="Events stored in this browser for use without a network">
        <template #actions>
          <v-chip v-if="!online" :prepend-icon="mdiWifiOff" size="small" variant="tonal">No network</v-chip>
          <v-btn v-else variant="tonal" size="small" :prepend-icon="mdiArrowLeft" to="/">Back to OpenMeshTak</v-btn>
        </template>
      </ViewHeader>

      <ErrorState v-if="state === 'error'" :message="error" @retry="load" />
      <v-skeleton-loader v-else-if="state === 'loading'" type="table" />
      <EmptyState
        v-else-if="snapshots.length === 0"
        :icon="mdiMapMarkerRadiusOutline"
        title="No event stored"
        text="Prepare an event while online: open the event, choose “Offline HQ” and store its published Data Packages in this browser."
      />
      <v-card v-else>
        <DataTable :headers="headers" :items="snapshots" item-value="eventId" search-label="Search stored events" storage-key="offline-events">
          <template #[`header.storedAt`]="{ column }">
            {{ column.title }}
            <InfoHint text="Published content as it was when this browser stored it. Changes made since then are not included until the event is prepared again." />
          </template>
          <template #[`item.name`]="{ item }"><span class="font-weight-medium">{{ item.snapshot.event.name }}</span></template>
          <template #[`item.storedAt`]="{ item }">{{ dateFormat.format(new Date(item.storedAt)) }}</template>
          <template #[`item.complete`]="{ item }">
            <span v-if="item.complete">Stored</span>
            <span v-else class="text-error">Incomplete, prepare again</span>
          </template>
          <template #[`item.actions`]="{ item }">
            <span class="text-no-wrap">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                :disabled="!item.complete"
                :to="{ name: 'offline-live', params: { eventId: item.eventId } }"
              >
                Open
              </v-btn>
              <v-btn size="small" variant="text" :icon="mdiDeleteOutline" aria-label="Remove from this browser" @click="askClear(item)" />
            </span>
          </template>
        </DataTable>
      </v-card>
    </v-container>

    <ConfirmDialog
      v-model="clearOpen"
      title="Remove offline event data?"
      confirm-label="Remove"
      confirm-color="error"
      @confirm="confirmClear"
    >
      The stored map content of “{{ clearing?.snapshot.event.name }}” is deleted from this browser. Using it offline again needs a new
      preparation while online.
    </ConfirmDialog>
  </v-main>
</template>
