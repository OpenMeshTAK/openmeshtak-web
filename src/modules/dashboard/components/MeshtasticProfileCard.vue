<script setup lang="ts">
import { mdiDownload, mdiKeyAlert, mdiOpenInNew, mdiRadioTower } from "@mdi/js";
import { computed, ref, watch } from "vue";
import type { Schemas } from "@/shared/api/types";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { saveFile } from "@/shared/files/save-file";
import { useToast } from "@/shared/feedback/toast";
import { downloadDeviceProfile } from "../dashboard.api";

/**
 * Firmware notice and the member's Meshtastic settings file. The file is only offered after the
 * firmware notice was acknowledged, because settings for a newer firmware can misconfigure an
 * older radio. Delivery is a plain file the Meshtastic app imports; nothing is promised beyond that.
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
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-icon :icon="mdiRadioTower" size="small" />
      <div class="text-title-medium font-weight-medium">Meshtastic radio</div>
      <v-spacer />
      <v-btn
        v-if="firmware"
        :href="firmware.flasherUrl"
        target="_blank"
        rel="noopener noreferrer"
        variant="tonal"
        size="small"
        :append-icon="mdiOpenInNew"
      >
        Open flasher
      </v-btn>
    </div>

    <p v-if="firmware === null" class="text-body-medium text-medium-emphasis my-0">
      The Meshtastic settings are not published yet. Ask the organizers to publish the event configuration.
    </p>
    <template v-else>
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <span class="text-body-large">Flash firmware</span>
        <v-chip size="small" color="primary" variant="tonal" label class="font-weight-bold">
          {{ firmware.recommendedVersion }}
        </v-chip>
        <span class="text-body-medium text-medium-emphasis">at least {{ firmware.minimumVersion }} · {{ firmware.channel }}</span>
        <InfoHint label="About the firmware">
          {{ firmware.flashingNotes ?? "Flash this firmware before importing the settings file." }}
          Settings made for a newer firmware can misconfigure an older radio.
        </InfoHint>
      </div>

      <v-divider class="my-4" />

      <div class="download-row">
        <v-checkbox v-model="acknowledged" :label="acknowledgement" density="compact" hide-details />
        <div class="download-row__actions">
          <v-btn color="primary" :prepend-icon="mdiDownload" :disabled="!acknowledged" :loading="downloading" @click="download">
            Download settings file
          </v-btn>
          <DownloadQrButton
            :disabled="!acknowledged"
            :request="{ kind: 'device-profile', eventId: profile.eventId, memberId: profile.memberId }"
            file-label="the Meshtastic settings file"
            secret-notice="The file contains channel keys. Scan it only with the phone that sets up this radio."
          />
        </div>
      </div>
      <v-alert type="warning" density="compact" :icon="mdiKeyAlert" class="mt-3">
        <div class="d-flex align-center ga-1">
          <span>
            <strong>Contains channel keys{{ onBehalf ? " for this member" : "" }}. Do not share this file.</strong>
            <template v-if="onBehalf"> The download is recorded in the audit log.</template>
          </span>
          <InfoHint label="About the settings file">
            Import the file in the Meshtastic app. It sets this event's channels and radio settings. Anyone
            with the file can read and transmit on the event's channels.
          </InfoHint>
        </div>
      </v-alert>
    </template>
  </v-card>
</template>

<style scoped>
.download-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.download-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 599px) {
  .download-row__actions,
  .download-row__actions > * {
    width: 100%;
  }
}
</style>
