<script setup lang="ts">
import { mdiDownload, mdiMagnify } from "@mdi/js";
import InfoHint from "@/shared/components/InfoHint.vue";

export interface HistoryFilterForm {
  /** `datetime-local` values in the browser's time zone. */
  from: string;
  to: string;
  groupId: string | null;
  gapSeconds: number;
}

defineProps<{
  groups: Array<{ id: string; name: string }>;
  loading: boolean;
  /** Export links for the loaded filter, or null before anything was loaded. */
  exportLinks: { geojson: string; gpx: string } | null;
}>();
const form = defineModel<HistoryFilterForm>({ required: true });
defineEmits<{ load: [] }>();

const gapChoices = [
  { title: "1 min", value: 60 },
  { title: "2 min", value: 120 },
  { title: "5 min", value: 300 },
  { title: "10 min", value: 600 },
  { title: "30 min", value: 1800 },
];
</script>

<template>
  <form class="history-filter d-flex align-center flex-wrap ga-2 px-4 py-2" @submit.prevent="$emit('load')">
    <v-text-field v-model="form.from" type="datetime-local" label="From" density="compact" hide-details max-width="210" />
    <v-text-field v-model="form.to" type="datetime-local" label="To" density="compact" hide-details max-width="210" />
    <v-select
      v-model="form.groupId"
      :items="[{ id: null, name: 'All groups' }, ...groups]"
      item-title="name"
      item-value="id"
      label="Sent by"
      density="compact"
      hide-details
      max-width="200"
    />
    <v-select v-model="form.gapSeconds" :items="gapChoices" label="Break track after" density="compact" hide-details max-width="160" />
    <InfoHint label="About track breaks">
      <p class="mb-2">
        Lines connect only positions that were really received one after the other. A track is broken when no position arrived
        for this long, when it jumps further than anyone could move, or at approximate positions.
      </p>
      <p class="mb-2">
        Meshtastic positions often arrive late, twice or with reduced precision. Late positions are placed at their own time,
        duplicates are dropped and approximate positions are drawn as dashed circles of their stated accuracy.
      </p>
      <p>Positions that were never received cannot be shown. Only events that record TAK traffic have a history.</p>
    </InfoHint>
    <v-btn type="submit" color="primary" variant="tonal" :prepend-icon="mdiMagnify" :loading="loading">Load</v-btn>
    <v-spacer />
    <v-menu v-if="exportLinks !== null">
      <template #activator="{ props: activator }">
        <v-btn v-bind="activator" variant="text" :prepend-icon="mdiDownload">Export tracks</v-btn>
      </template>
      <v-list density="compact">
        <v-list-item :href="exportLinks.gpx" download title="GPX" subtitle="One track per device, one segment per continuous part" />
        <v-list-item :href="exportLinks.geojson" download title="GeoJSON" subtitle="One feature per continuous part" />
      </v-list>
    </v-menu>
  </form>
</template>

<style scoped>
.history-filter {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
