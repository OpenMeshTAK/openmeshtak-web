<script setup lang="ts">
import { ref, watch } from "vue";
import type { PresentationReport } from "@/modules/data-packages/data-packages.api";
const props = defineProps<{ report: PresentationReport | null }>();
const open = ref(false);
watch(() => props.report, (report) => { open.value = report !== null && report.losses.length > 0; });
</script>
<template>
  <v-dialog v-model="open" max-width="760" scrollable>
    <v-card title="Shown differently">
      <v-card-text>
        <p class="mb-3">The download is ready. {{ report?.format === 'cot' ? 'ATAK shows these objects differently from the editor. Importing the Data Package back into OpenMeshTak restores them exactly.' : 'KML tools show these objects differently from the editor. Use the Data Package or GeoJSON to keep every detail.' }}</p>
        <v-list lines="three">
          <v-list-item v-for="(loss, index) in report?.losses" :key="index" :title="loss.objectName" :subtitle="loss.message" />
        </v-list>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn text="Close" @click="open = false" /></v-card-actions>
    </v-card>
  </v-dialog>
</template>
