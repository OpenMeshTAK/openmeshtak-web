<script setup lang="ts">
import { mdiDeleteOutline, mdiDownload, mdiMapClock } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import {
  deleteRecordedTakTraffic,
  getTakTrafficRecording,
  saveTakTrafficRecording,
  takTrafficExportUrl,
  type TakTrafficRecordingDto,
} from "../tak-server.api";

/**
 * Opt-in recording of the event's TAK traffic, a switch in the event options. Positions are personal data,
 * so recording is off by default, needs `tak-traffic.recording` to change, and stored items are deleted
 * after the retention. TAK apps can query the recorded history from the TAK server.
 */
const props = defineProps<{ eventId: string }>();
const session = useSession();
const toast = useToast();

const recording = ref<TakTrafficRecordingDto | null>(null);
const retentionDays = ref(30);
const saving = ref(false);
const canManage = computed(() => session.can("tak-traffic.recording", props.eventId));
const confirmDelete = ref(false);
const deleting = ref(false);

function show(loaded: TakTrafficRecordingDto): void {
  recording.value = loaded;
  retentionDays.value = loaded.retentionDays;
}

async function save(enabled: boolean): Promise<void> {
  if (recording.value === null) {
    return;
  }
  saving.value = true;
  try {
    show(await saveTakTrafficRecording(props.eventId, recording.value.version, enabled, retentionDays.value));
    toast.success(enabled ? "TAK traffic of this event is recorded." : "Recording stopped. Stored traffic is kept until the retention ends.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

/** Deletes all stored traffic now, e.g. after the event or when participants ask for it. */
async function deleteStored(): Promise<void> {
  deleting.value = true;
  try {
    const { deleted } = await deleteRecordedTakTraffic(props.eventId);
    toast.success(`${String(deleted)} recorded items deleted.`);
    confirmDelete.value = false;
    show(await getTakTrafficRecording(props.eventId));
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    deleting.value = false;
  }
}

function toggle(value: boolean | null): void {
  void save(value === true);
}

onMounted(async () => {
  try {
    show(await getTakTrafficRecording(props.eventId));
  } catch (caught: unknown) {
    toast.error(caught);
  }
});
</script>

<template>
  <!-- One row like the other options; retention and count only appear while recording. -->
  <div v-if="recording !== null" class="d-flex align-center flex-wrap ga-2">
    <v-switch
      :model-value="recording.enabled"
      label="Record TAK traffic"
      color="primary"
      inset
      hide-details
      class="flex-grow-0"
      :loading="saving"
      :disabled="!canManage || saving"
      @update:model-value="toggle($event)"
    />
    <InfoHint label="About TAK traffic recording">
      <p class="mb-2">
        Stores the positions, markers and drawings of this event so they can be replayed under History, exported, and so
        members' TAK apps can ask the server for a track history. Chats and direct messages are never stored.
      </p>
      <p>Positions are personal data: recording is off by default and stored items are deleted after the retention period.</p>
    </InfoHint>
    <template v-if="recording.enabled">
      <v-text-field
        v-model.number="retentionDays"
        type="number"
        aria-label="Keep recorded traffic for this many days"
        suffix="days"
        density="compact"
        max-width="110"
        hide-details
        :disabled="!canManage"
      />
      <v-btn
        v-if="canManage && retentionDays !== recording.retentionDays"
        size="small"
        variant="tonal"
        :loading="saving"
        @click="save(true)"
      >
        Save
      </v-btn>
      <span class="text-body-small text-medium-emphasis">{{ recording.storedItems }} stored</span>
    </template>
    <!-- Stored traffic stays until the retention ends, so it can still be exported after recording stops. -->
    <v-btn
      v-if="session.can('tak-traffic.export', eventId) && recording.storedItems > 0"
      :href="takTrafficExportUrl(eventId)"
      download
      size="small"
      variant="text"
      :prepend-icon="mdiDownload"
    >
      Export
    </v-btn>
    <v-btn
      v-if="session.can('tak-traffic.history', eventId) && recording.storedItems > 0"
      :to="{ name: 'event-history', params: { eventId } }"
      size="small"
      variant="text"
      :prepend-icon="mdiMapClock"
    >
      History
    </v-btn>
    <v-btn
      v-if="session.can('tak-traffic.delete', eventId) && recording.storedItems > 0"
      size="small"
      variant="text"
      :prepend-icon="mdiDeleteOutline"
      @click="confirmDelete = true"
    >
      Delete stored
    </v-btn>
    <ConfirmDialog
      v-model="confirmDelete"
      title="Delete all recorded TAK traffic?"
      confirm-label="Delete"
      confirm-color="error"
      :loading="deleting"
      @confirm="deleteStored"
    >
      All {{ recording.storedItems }} stored positions, markers and drawings of this event are deleted now instead of after the
      retention. History, exports and TAK apps' history queries no longer find them. This cannot be undone.
    </ConfirmDialog>
  </div>
</template>
