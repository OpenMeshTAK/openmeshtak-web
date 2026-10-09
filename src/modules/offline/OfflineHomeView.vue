<script setup lang="ts">
import { mdiDeleteOutline, mdiMapMarkerRadiusOutline, mdiWifiOff } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useNetworkState } from "./useNetworkState";
import { clearEvent, listSnapshots, type StoredSnapshot } from "./offline-store";

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

function askClear(record: StoredSnapshot): void {
  clearing.value = record;
  clearOpen.value = true;
}

async function confirmClear(): Promise<void> {
  if (clearing.value !== null) {
    await clearEvent(clearing.value.eventId);
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
          <v-btn v-else variant="text" size="small" to="/">Back to OpenMeshTak</v-btn>
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
        <v-table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Packages</th>
              <th>
                Stored
                <InfoHint text="Published content as it was when this browser stored it. Changes made since then are not included until the event is prepared again." />
              </th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in snapshots" :key="record.eventId">
              <td class="font-weight-medium">{{ record.snapshot.event.name }}</td>
              <td>{{ record.snapshot.packages.length }}</td>
              <td>{{ dateFormat.format(new Date(record.storedAt)) }}</td>
              <td>
                <span v-if="record.complete">Stored</span>
                <span v-else class="text-error">Incomplete, prepare again</span>
              </td>
              <td class="text-right text-no-wrap">
                <v-btn
                  size="small"
                  variant="tonal"
                  color="primary"
                  :disabled="!record.complete"
                  :to="{ name: 'offline-live', params: { eventId: record.eventId } }"
                >
                  Open
                </v-btn>
                <v-btn size="small" variant="text" :icon="mdiDeleteOutline" aria-label="Remove from this browser" @click="askClear(record)" />
              </td>
            </tr>
          </tbody>
        </v-table>
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
