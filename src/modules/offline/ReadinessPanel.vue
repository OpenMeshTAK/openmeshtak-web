<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiCloseCircleOutline } from "@mdi/js";
import { onMounted, ref } from "vue";
import { checkReadiness, type CheckState, type ReadinessCheck } from "./readiness";

/**
 * The offline ready check: what this browser has really stored, plus the manual no-network test
 * the operator should run before the event. Only the operator can run that test; the app never
 * marks it as done.
 */
const props = defineProps<{ eventId: string }>();

const checks = ref<ReadinessCheck[]>([]);
const checking = ref(false);
const icons: Record<CheckState, string> = { ok: mdiCheckCircleOutline, warning: mdiAlertCircleOutline, error: mdiCloseCircleOutline };
const colors: Record<CheckState, string> = { ok: "success", warning: "warning", error: "error" };

const manualSteps = [
  "Install the app (browser menu → Install) and open it from there once while online.",
  "Close the app, stop the network (airplane mode or unplug), then start the installed app again.",
  "Open Offline HQ and this event: the map and Data Package layers must appear.",
  "Connect the radio with “Connect radio” and wait until mesh nodes appear.",
  "Unplug the radio, check that the map shows it, plug it in again and use “Reconnect”.",
];

async function run(): Promise<void> {
  checking.value = true;
  try {
    checks.value = await checkReadiness(props.eventId);
  } finally {
    checking.value = false;
  }
}

onMounted(run);
defineExpose({ run });
</script>

<template>
  <div>
    <div class="d-flex align-center mb-2">
      <div class="text-title-small flex-grow-1">Checked in this browser</div>
      <v-btn size="small" variant="text" :loading="checking" @click="run">Check again</v-btn>
    </div>
    <v-list density="compact" class="pa-0 mb-4">
      <v-list-item v-for="check in checks" :key="check.id" :title="check.label" :subtitle="check.detail" lines="two" class="px-0">
        <template #prepend>
          <v-icon :icon="icons[check.state]" :color="colors[check.state]" />
        </template>
      </v-list-item>
    </v-list>

    <div class="text-title-small mb-1">Test without network before the event</div>
    <ol class="text-body-medium pl-5">
      <li v-for="step in manualSteps" :key="step" class="mb-1">{{ step }}</li>
    </ol>
  </div>
</template>
