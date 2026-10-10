<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSession } from "@/modules/auth/session";
import { describeError } from "@/shared/errors/api-problem";
import { listDataPackages, type DataPackageDto } from "@/modules/data-packages/data-packages.api";
import { topFirst } from "@/modules/data-packages/package-order";
import { clearEvent, readSnapshot, type StoredSnapshot } from "./offline-store";
import { formatBytes, OfflinePreparationError, prepareOfflineEvent, type PrepareProgress } from "./prepare-snapshot";
import ReadinessPanel from "./ReadinessPanel.vue";

/**
 * Explicit, operator-started preparation of the offline HQ view: the selected published Data
 * Packages and missions are stored in this browser. Nothing is stored before the operator
 * confirms, and the stored copy can be removed here or from the Offline HQ page.
 */
const props = defineProps<{ eventId: string; eventName: string }>();
const open = defineModel<boolean>({ required: true });
const session = useSession();

const packages = ref<DataPackageDto[]>([]);
const selected = ref<string[]>([]);
const stored = ref<StoredSnapshot | null>(null);
const state = ref<"loading" | "ready" | "preparing" | "done">("loading");
const error = ref("");
const progress = ref<PrepareProgress>({ done: 0, total: 0 });
let controller: AbortController | null = null;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const published = computed(() => packages.value.filter(({ latestRevision }) => latestRevision !== null));
const unpublished = computed(() => packages.value.filter(({ latestRevision }) => latestRevision === null));
const percent = computed(() => (progress.value.total === 0 ? 0 : Math.round((progress.value.done / progress.value.total) * 100)));

async function load(): Promise<void> {
  state.value = "loading";
  error.value = "";
  try {
    const [regular, missions, existing] = await Promise.all([
      session.can("data-packages.read", props.eventId) ? listDataPackages(props.eventId, "package") : Promise.resolve([]),
      session.can("missions.read", props.eventId) ? listDataPackages(props.eventId, "mission") : Promise.resolve([]),
      readSnapshot(props.eventId).catch(() => null),
    ]);
    packages.value = [...topFirst(regular), ...topFirst(missions)];
    stored.value = existing;
    const previous = new Set(existing?.snapshot.packages.map(({ packageId }) => packageId) ?? []);
    selected.value = published.value
      .filter(({ id }) => previous.size === 0 || previous.has(id))
      .map(({ id }) => id);
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "ready";
  }
}

function preparationError(caught: unknown): string {
  if (caught instanceof OfflinePreparationError) {
    return caught.message;
  }
  if (caught instanceof DOMException && caught.name === "QuotaExceededError") {
    return "The browser ran out of storage space. Free space or select fewer packages.";
  }
  return describeError(caught);
}

async function prepare(): Promise<void> {
  controller = new AbortController();
  state.value = "preparing";
  error.value = "";
  progress.value = { done: 0, total: 0 };
  // Keep the event's drawing order: top package first.
  const ids = packages.value.map(({ id }) => id).filter((id) => selected.value.includes(id));
  try {
    stored.value = await prepareOfflineEvent(props.eventId, ids, (next) => (progress.value = next), controller.signal);
    state.value = "done";
  } catch (caught: unknown) {
    error.value = controller.signal.aborted ? "Preparation cancelled. The stored copy is incomplete." : preparationError(caught);
    stored.value = await readSnapshot(props.eventId).catch(() => null);
    state.value = "ready";
  } finally {
    controller = null;
  }
}

async function remove(): Promise<void> {
  await clearEvent(props.eventId);
  stored.value = null;
  state.value = "ready";
}

watch(open, (isOpen) => {
  if (isOpen) {
    void load();
  } else {
    controller?.abort();
  }
});
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable :persistent="state === 'preparing'">
    <v-card>
      <v-card-title class="text-title-large text-wrap">
        Offline HQ for {{ eventName }}
        <InfoHint tone="warning" label="Offline data cannot be revoked">
          The data stays on this computer until it is removed here or on the Offline HQ page. Revoking someone's event access
          does not delete data that is already stored. Only prepare the event on computers you trust.
        </InfoHint>
      </v-card-title>
      <v-card-text>
        <p class="text-body-medium mt-0">
          Stores the published Data Packages you select in this browser, so the event map works at the HQ without internet or
          server. A USB Meshtastic radio then shows live node positions on it. Drafts, keys, certificates and member data are
          never stored.
        </p>

        <v-alert v-if="error !== ''" type="error" density="compact" class="mb-3">{{ error }}</v-alert>

        <div v-if="stored !== null && state !== 'preparing'" class="d-flex flex-wrap align-center ga-2 mb-3">
          <span class="text-body-medium flex-grow-1">
            <template v-if="stored.complete">Stored {{ dateFormat.format(new Date(stored.storedAt)) }} with {{ stored.snapshot.packages.length }} packages.</template>
            <span v-else class="text-error">The stored copy is incomplete. Prepare again.</span>
          </span>
          <v-btn v-if="stored.complete" size="small" variant="tonal" :to="{ name: 'offline-live', params: { eventId } }">Open offline HQ</v-btn>
          <v-btn size="small" variant="text" color="error" @click="remove">Remove from this browser</v-btn>
        </div>

        <template v-if="state === 'done'">
          <ReadinessPanel :event-id="eventId" />
        </template>
        <template v-else-if="state === 'preparing'">
          <div class="text-body-medium mb-2">Storing map content… {{ progress.done }} of {{ progress.total }}</div>
          <v-progress-linear :model-value="percent" color="primary" height="8" rounded />
        </template>
        <v-skeleton-loader v-else-if="state === 'loading'" type="list-item@3" />
        <template v-else>
          <div class="text-title-small mb-1">Published packages</div>
          <p v-if="published.length === 0" class="text-body-medium text-medium-emphasis">Nothing is published in this event yet.</p>
          <v-checkbox
            v-for="item in published"
            :key="item.id"
            v-model="selected"
            :value="item.id"
            density="compact"
            hide-details
          >
            <template #label>
              <span>
                {{ item.name }}
                <span class="text-medium-emphasis">
                  · {{ item.kind === "mission" ? "mission" : "package" }} revision {{ item.latestRevision }}<template v-if="item.latestRevisionSize !== null"> · about {{ formatBytes(item.latestRevisionSize) }}</template>
                </span>
              </span>
            </template>
          </v-checkbox>
          <p v-if="unpublished.length > 0" class="text-body-small text-medium-emphasis mt-2 mb-0">
            Not published, so not available offline: {{ unpublished.map(({ name }) => name).join(", ") }}.
          </p>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn v-if="state === 'preparing'" variant="text" @click="controller?.abort()">Cancel</v-btn>
        <template v-else>
          <v-btn variant="text" @click="open = false">Close</v-btn>
          <v-btn
            v-if="state !== 'done'"
            color="primary"
            :disabled="selected.length === 0 || state === 'loading'"
            @click="prepare"
          >
            {{ stored === null ? "Store for offline use" : "Store again" }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
