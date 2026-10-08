<script setup lang="ts">
import { mdiCellphoneLink } from "@mdi/js";
import { computed, ref } from "vue";
import type { Schemas } from "@/shared/api/types";
import InfoHint from "@/shared/components/InfoHint.vue";

/**
 * Steps to connect ATAK/iTAK through the Meshtastic app's local TAK server. The app creates the
 * TAK certificates on the phone, so the TAK Data Package comes from the app, not from OpenMeshTak.
 * Menu paths follow the official Meshtastic documentation; the flow was verified on real devices
 * (2026-10-06).
 */
const props = defineProps<{ profile: Schemas["ResolvedProfileDto"] }>();
const platform = ref<"android" | "ios">("android");

const channelText = computed(() => {
  const channel = props.profile.tak.meshtasticLocalServer?.meshChannel ?? null;
  return channel === null
    ? "the primary channel (0)"
    : `${String(channel.slot)} · ${channel.name}`;
});

const steps = computed(() =>
  platform.value === "android"
    ? [
        "Import your Meshtastic device file first, so the radio has this event's channels and settings.",
        "In the Meshtastic app open Settings → Module Config → TAK → TAK Server and turn on “Enable Local TAK Server”.",
        `Set “TAK Mesh Channel” to ${channelText.value}.`,
        "Tap “Export TAK Data Package” and import the file in ATAK.",
        "Import this event's data packages below into ATAK as well.",
      ]
    : [
        "Import your Meshtastic device file first, so the radio has this event's channels and settings.",
        "In the Meshtastic app open Settings, scroll to the bottom to TAK Server and start the TAK Server.",
        `If the app offers a TAK mesh channel, choose ${channelText.value}.`,
        "Download the TAK Data Package from the app and import it in iTAK or TAK Aware.",
        "Import this event's data packages below into iTAK as well.",
      ],
);
</script>

<template>
  <v-card>
    <div class="pa-5 pb-3">
      <div class="d-flex align-center ga-2 flex-wrap mb-1">
        <v-icon :icon="mdiCellphoneLink" size="small" />
        <span class="text-title-medium font-weight-medium">Connect TAK over Meshtastic</span>
        <InfoHint label="How TAK over Meshtastic works">
          ATAK or iTAK on this phone talks to the Meshtastic app, which sends TAK over the mesh as
          {{ profile.tak.callsign }}.
        </InfoHint>
      </div>
    </div>
    <v-tabs v-model="platform" density="compact" class="px-3">
      <v-tab value="android">Android</v-tab>
      <v-tab value="ios">iPhone</v-tab>
    </v-tabs>
    <v-divider />
    <ol class="steps text-body-medium pa-5 pl-10">
      <li v-for="step in steps" :key="step">{{ step }}</li>
    </ol>
  </v-card>
</template>

<style scoped>
.steps {
  display: grid;
  gap: 8px;
  margin: 0;
}
</style>
