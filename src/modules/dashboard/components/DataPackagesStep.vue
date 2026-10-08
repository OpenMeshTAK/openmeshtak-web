<script setup lang="ts">
import { mdiMapOutline } from "@mdi/js";
import TakEnrollmentAction from "@/modules/tak-server/components/TakEnrollmentAction.vue";
import DataPackageList from "./DataPackageList.vue";
import InfoHint from "@/shared/components/InfoHint.vue";

/**
 * The member's Data Packages. A TAK app connected to the TAK server loads them from there, some by
 * itself depending on each package's settings; each package can also be downloaded here.
 */
defineProps<{
  eventId: string;
  memberId: string;
  /** The previous step already enrolls the app with the TAK server, so it is not offered twice. */
  enrolledInSetup: boolean;
}>();
</script>

<template>
  <v-card>
    <div class="d-flex align-center ga-2 pa-5 pb-2">
      <v-icon :icon="mdiMapOutline" size="small" />
      <div class="text-title-medium font-weight-medium">Get the map data</div>
      <InfoHint
        label="About Data Packages"
        text="Map content for ATAK and iTAK, such as the game area, points of interest and offline maps."
      />
    </div>
    <p class="d-flex align-center ga-1 text-body-medium px-5 mt-0 mb-3">
      Load the packages in your TAK app from the TAK server, or download them here and import the .zip yourself.
      <InfoHint
        label="About manual downloads"
        text="A downloaded file does not update when the organizers publish a new revision. Download it again, or load it from the TAK server."
      />
    </p>
    <div v-if="!enrolledInSetup" class="px-5 pb-3">
      <TakEnrollmentAction label="Enroll a TAK app" />
    </div>
    <DataPackageList :event-id="eventId" :member-id="memberId" />
  </v-card>
</template>
