<script setup lang="ts">
import { mdiDownload, mdiRecordRec } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { getTakTrafficRecording, saveTakTrafficRecording, takTrafficExportUrl, type TakTrafficRecordingDto } from "../tak-server.api";

/**
 * Opt-in recording of the event's TAK traffic. Positions are personal data, so recording is off by
 * default, needs `events.manage` to change, and stored items are deleted after the retention.
 */
const props = defineProps<{ eventId: string }>();
const session = useSession();
const toast = useToast();

const recording = ref<TakTrafficRecordingDto | null>(null);
const enabled = ref(false);
const retentionDays = ref(30);
const saving = ref(false);
const canManage = session.can("events.manage", props.eventId);

function show(loaded: TakTrafficRecordingDto): void {
  recording.value = loaded;
  enabled.value = loaded.enabled;
  retentionDays.value = loaded.retentionDays;
}

async function save(): Promise<void> {
  if (recording.value === null) {
    return;
  }
  saving.value = true;
  try {
    show(await saveTakTrafficRecording(props.eventId, recording.value.version, enabled.value, retentionDays.value));
    toast.success(enabled.value ? "TAK traffic of this event is recorded." : "Recording stopped. Stored traffic is kept until the retention ends.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    saving.value = false;
  }
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
  <div v-if="recording" class="pa-3">
    <div class="d-flex align-center ga-2 mb-1">
      <v-icon :icon="mdiRecordRec" size="small" :color="recording.enabled ? 'error' : undefined" />
      <div class="text-title-small flex-grow-1">Recording</div>
      <span class="text-body-small text-medium-emphasis">{{ recording.storedItems }} stored</span>
      <v-switch
        v-if="canManage"
        v-model="enabled"
        class="flex-grow-0 flex-shrink-0"
        aria-label="Record this event's traffic"
        color="error"
        density="compact"
        hide-details
        inset
      />
    </div>
    <template v-if="canManage">
      <v-text-field v-if="enabled" v-model.number="retentionDays" type="number" label="Keep for" suffix="days" density="compact" class="mt-2" hide-details />
      <!-- Disabled and saved as disabled: nothing to save. -->
      <v-btn
        v-if="enabled || recording.enabled"
        block
        variant="tonal"
        size="small"
        class="mt-2"
        :loading="saving"
        :disabled="enabled === recording.enabled && retentionDays === recording.retentionDays"
        @click="save"
      >
        Save
      </v-btn>
    </template>
    <p v-else class="text-body-small text-medium-emphasis my-0">
      {{ recording.enabled ? `Recorded and kept for ${recording.retentionDays} days.` : "Not recorded." }}
    </p>
    <v-btn
      v-if="recording.storedItems > 0"
      :href="takTrafficExportUrl(eventId)"
      download
      block
      variant="text"
      size="small"
      class="mt-1"
      :prepend-icon="mdiDownload"
    >
      Export as GeoJSON
    </v-btn>
  </div>
</template>
