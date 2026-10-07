<script setup lang="ts">
import { mdiCheckDecagram, mdiOpenInNew } from "@mdi/js";
import { computed, ref } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import type { FirmwareReleaseListDto } from "../firmware-releases.api";

/**
 * Firmware builds the official flasher offers, marked with whether a shipped profile supports
 * them. Support comes from OpenMeshTak's profiles, never from upstream.
 */
const props = defineProps<{ list: FirmwareReleaseListDto }>();

const COLLAPSED_ROWS = 6;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const expanded = ref(false);

const rows = computed(() => (expanded.value ? props.list.releases : props.list.releases.slice(0, COLLAPSED_ROWS)));
const fetchedAt = computed(() => (props.list.fetchedAt === null ? "" : dateFormat.format(new Date(props.list.fetchedAt))));

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center ga-1 mb-1">
      <span class="text-title-medium font-weight-medium">Published releases</span>
      <InfoHint
        label="About published releases"
        text="Full releases from flasher.meshtastic.org, newest first. Revoked and pull-request builds are left out. Releases of a line without a firmware profile are not supported."
      />
    </div>
    <p v-if="list.status === 'cached'" class="text-body-medium text-warning ma-0 mb-2">
      List from {{ fetchedAt }}; the Meshtastic flasher could not be reached since.
    </p>
    <p v-else class="text-body-small text-medium-emphasis ma-0 mb-2">Updated {{ fetchedAt }}</p>

    <v-table density="compact">
      <thead>
        <tr>
          <th>Version</th>
          <th>Build</th>
          <th>Channel</th>
          <th>Support</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="release in rows" :key="`${release.version}.${release.build}`">
          <td>{{ release.version }}</td>
          <td><code class="text-body-small">{{ release.build }}</code></td>
          <td :class="{ 'text-warning': release.channel === 'alpha' }">{{ capitalize(release.channel) }}</td>
          <td>
            <v-chip v-if="release.support === 'tested'" size="small" variant="tonal" label color="success" :prepend-icon="mdiCheckDecagram">
              Tested on a device
            </v-chip>
            <span v-else-if="release.support === 'supported'">Supported</span>
            <span v-else class="text-medium-emphasis">Not supported</span>
          </td>
          <td class="text-right">
            <v-btn
              :href="release.releaseUrl"
              target="_blank"
              rel="noopener noreferrer"
              variant="text"
              size="small"
              :icon="mdiOpenInNew"
              :aria-label="`Release notes for ${release.version}`"
            />
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-btn v-if="list.releases.length > COLLAPSED_ROWS" variant="text" size="small" class="mt-2" @click="expanded = !expanded">
      {{ expanded ? "Show fewer" : `Show all ${list.releases.length}` }}
    </v-btn>
  </v-card>
</template>
