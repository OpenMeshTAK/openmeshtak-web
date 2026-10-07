<script setup lang="ts">
import { mdiMapOutline } from "@mdi/js";
import { ref } from "vue";
import TakEnrollmentAction from "@/modules/tak-server/components/TakEnrollmentAction.vue";
import DataPackageList from "./DataPackageList.vue";
import InfoHint from "@/shared/components/InfoHint.vue";

/**
 * How the member gets the event's Data Packages. The TAK server delivers them to an enrolled app,
 * so that is the default; the manual download stays as a backup for a package that did not arrive.
 */
defineProps<{
  eventId: string;
  memberId: string;
  /** The previous step already enrolls the app with the TAK server, so it is not offered twice. */
  enrolledInSetup: boolean;
}>();

const method = ref<"tak-server" | "manual">("tak-server");
</script>

<template>
  <v-card>
    <div class="d-flex align-center ga-2 pa-5 pb-3">
      <v-icon :icon="mdiMapOutline" size="small" />
      <div class="text-title-medium font-weight-medium">Data packages</div>
      <InfoHint
        label="About Data Packages"
        text="Map content for ATAK and iTAK, such as the game area, points of interest and offline maps."
      />
    </div>

    <v-tabs v-model="method" density="compact" class="px-3">
      <v-tab value="tak-server">Via TAK server</v-tab>
      <v-tab value="manual">Manual download</v-tab>
    </v-tabs>
    <v-divider />

    <v-window v-model="method">
      <v-window-item value="tak-server">
        <div class="pa-5">
          <p v-if="enrolledInSetup" class="text-body-medium my-0">
            Once your TAK app is connected in step 2, the TAK server delivers this event's Data Packages to it.
          </p>
          <template v-else>
            <div class="d-flex align-center ga-1 flex-wrap mb-3">
              <span class="text-body-medium">The TAK server sends the packages to your enrolled app.</span>
              <InfoHint
                label="How enrollment works"
                text="Scan the QR code in ATAK, import the connection package, or enter the login data by hand."
              />
            </div>
            <TakEnrollmentAction label="Enroll a TAK app" />
          </template>
        </div>
      </v-window-item>

      <v-window-item value="manual">
        <p class="d-flex align-center ga-1 text-body-medium text-medium-emphasis px-5 pt-3 my-0">
          Download a package and import the .zip in ATAK or iTAK yourself.
          <InfoHint
            label="About manual downloads"
            text="Use this when your TAK app is not connected to the TAK server, or a package is missing in the app. A downloaded file does not update when the organizers publish a new revision."
          />
        </p>
        <DataPackageList :event-id="eventId" :member-id="memberId" />
      </v-window-item>
    </v-window>
  </v-card>
</template>
