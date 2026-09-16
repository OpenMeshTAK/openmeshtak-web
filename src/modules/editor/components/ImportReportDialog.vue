<script setup lang="ts">
import { computed } from "vue";
import type { ImportReport } from "@/modules/data-packages/data-packages.api";

/** Shows every changed, skipped and rejected feature so nothing disappears silently (EDITOR.md). */
const props = defineProps<{ report: ImportReport | null }>();
const open = defineModel<boolean>({ required: true });

const sections = computed(() =>
  props.report === null
    ? []
    : [
        { title: "Changed", color: "info", entries: props.report.changed },
        { title: "Skipped (not supported)", color: "warning", entries: props.report.skipped },
        { title: "Rejected (invalid)", color: "error", entries: props.report.rejected },
      ].filter(({ entries }) => entries.length > 0),
);
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card v-if="report">
      <v-card-title>Import report</v-card-title>
      <v-card-text>
        <p class="text-body-1 mb-4">
          {{ report.accepted }} {{ report.accepted === 1 ? "object was" : "objects were" }} imported.
        </p>
        <div v-for="section in sections" :key="section.title" class="mb-4">
          <div class="text-subtitle-2 mb-1">
            <v-chip :color="section.color" size="small" label class="mr-2">{{ section.entries.length }}</v-chip>
            {{ section.title }}
          </div>
          <v-list density="compact" class="py-0">
            <v-list-item v-for="(entry, index) in section.entries" :key="index" :title="entry.feature" :subtitle="entry.message" />
          </v-list>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
