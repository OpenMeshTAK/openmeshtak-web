<script setup lang="ts">
import { mdiCheckDecagram, mdiOpenInNew } from "@mdi/js";
import { computed } from "vue";
import DataTable from "@/shared/components/DataTable.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import type { FirmwareReleaseDto, FirmwareReleaseListDto } from "../firmware-releases.api";

/**
 * Firmware builds the official flasher offers, marked with whether a shipped profile supports
 * them. Support comes from OpenMeshTak's profiles, never from upstream.
 */
const props = defineProps<{ list: FirmwareReleaseListDto }>();

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const rows = computed(() => props.list.releases.map((release) => ({ ...release, id: `${release.version}.${release.build}` })));
const headers = [
  { title: "Version", key: "version" },
  { title: "Build", key: "build" },
  { title: "Channel", key: "channel", value: (release: FirmwareReleaseDto) => capitalize(release.channel) },
  { title: "Support", key: "support" },
  { title: "Release notes", key: "actions", sortable: false, align: "end" as const },
];
const fetchedAt = computed(() => (props.list.fetchedAt === null ? "" : dateFormat.format(new Date(props.list.fetchedAt))));

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
</script>

<template>
  <v-card>
    <DataTable :headers="headers" :items="rows" search-label="Search releases" storage-key="firmware-releases" density="compact">
      <template #toolbar>
        <div>
          <div class="d-flex align-center ga-1">
            <span class="text-title-medium font-weight-medium">Published releases</span>
            <InfoHint
              label="About published releases"
              text="Full releases from flasher.meshtastic.org, newest first. Revoked and pull-request builds are left out. Releases of a line without a firmware profile are not supported."
            />
          </div>
          <p v-if="list.status === 'cached'" class="text-body-medium text-warning ma-0">
            List from {{ fetchedAt }}; the Meshtastic flasher could not be reached since.
          </p>
          <p v-else class="text-body-small text-medium-emphasis ma-0">Updated {{ fetchedAt }}</p>
        </div>
      </template>
      <template #[`item.build`]="{ item }"><code class="text-body-small">{{ item.build }}</code></template>
      <template #[`item.channel`]="{ item }">
        <span :class="{ 'text-warning': item.channel === 'alpha' }">{{ capitalize(item.channel) }}</span>
      </template>
      <template #[`item.support`]="{ item }">
        <v-chip v-if="item.support === 'tested'" size="small" variant="tonal" label color="success" :prepend-icon="mdiCheckDecagram">
          Tested on a device
        </v-chip>
        <span v-else-if="item.support === 'supported'">Supported</span>
        <span v-else class="text-medium-emphasis">Not supported</span>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          :href="item.releaseUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="text"
          size="small"
          :icon="mdiOpenInNew"
          :aria-label="`Release notes for ${item.version}`"
        />
      </template>
    </DataTable>
  </v-card>
</template>
