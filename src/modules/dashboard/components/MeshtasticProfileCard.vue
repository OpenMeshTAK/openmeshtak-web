<script setup lang="ts">
import { mdiDownload, mdiOpenInNew, mdiRadioTower } from "@mdi/js";
import { computed, ref, watch } from "vue";
import type { Schemas } from "@/shared/api/types";
import { saveFile } from "@/shared/files/save-file";
import { useToast } from "@/shared/feedback/toast";
import { downloadDeviceProfile } from "../dashboard.api";

/**
 * Firmware notice and the member's Meshtastic settings file. The file is only offered after the
 * firmware notice was acknowledged, because settings for a newer firmware can misconfigure an
 * older radio. Delivery is a plain file the Meshtastic app imports; nothing is promised beyond that
 * until a real device test has verified it.
 */
const props = defineProps<{
  profile: Schemas["ResolvedProfileDto"];
  /** An operator downloads the member's own file to set up the member's radio. */
  onBehalf?: boolean;
}>();

const toast = useToast();
const acknowledged = ref(false);
const downloading = ref(false);

const firmware = computed(() => props.profile.meshtastic.firmware);
const acknowledgement = computed(() => {
  const version = firmware.value?.minimumVersion ?? "";
  return props.onBehalf
    ? `${props.profile.callsign}'s radio runs Meshtastic ${version} or newer`
    : `My radio runs Meshtastic ${version} or newer`;
});

watch(
  () => props.profile.memberId,
  () => {
    acknowledged.value = false;
  },
);

async function download(): Promise<void> {
  downloading.value = true;
  try {
    const { blob, fileName } = await downloadDeviceProfile(props.profile.eventId, props.profile.memberId);
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center ga-2 mb-2">
      <v-icon :icon="mdiRadioTower" size="small" />
      <div class="text-subtitle-1 font-weight-medium flex-grow-1">Meshtastic radio</div>
      <v-chip v-if="firmware && !firmware.verified" size="small" color="warning" variant="tonal">Not verified</v-chip>
    </div>

    <p v-if="firmware === null" class="text-body-2 text-medium-emphasis mb-0">
      The Meshtastic settings are not published yet. Ask the organizers to publish the event configuration.
    </p>
    <template v-else>
      <p class="text-body-2 mb-2">
        Flash Meshtastic firmware <strong>{{ firmware.recommendedVersion }}</strong> first, at least
        {{ firmware.minimumVersion }} ({{ firmware.channel }}).
      </p>
      <p v-if="firmware.flashingNotes" class="text-body-2 text-medium-emphasis mb-2">{{ firmware.flashingNotes }}</p>
      <v-btn
        :href="firmware.flasherUrl"
        target="_blank"
        rel="noopener noreferrer"
        variant="text"
        size="small"
        class="px-0 mb-1"
        :append-icon="mdiOpenInNew"
      >
        Open the Meshtastic flasher
      </v-btn>

      <v-checkbox v-model="acknowledged" :label="acknowledgement" density="compact" hide-details class="mb-2" />
      <v-btn
        color="primary"
        block
        :prepend-icon="mdiDownload"
        :disabled="!acknowledged"
        :loading="downloading"
        @click="download"
      >
        Download settings file
      </v-btn>
      <p class="text-caption text-medium-emphasis mt-2 mb-0">
        Import the file in the Meshtastic app. It contains channel keys{{ onBehalf ? " for this member" : "" }}: do not share it.
        <template v-if="onBehalf"> The download is recorded in the audit log.</template>
      </p>
    </template>
  </v-card>
</template>
