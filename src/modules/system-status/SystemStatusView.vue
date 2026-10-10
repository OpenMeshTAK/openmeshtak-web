<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiCloseCircleOutline, mdiMinusCircleOutline, mdiRefresh } from "@mdi/js";
import { computed, onMounted, onUnmounted } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import MetricChart from "./MetricChart.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { getSystemStatus, type SystemCheckDto, type SystemCheckState, type SystemStatusDto } from "./system-status.api";

/** Health overview for operators; refreshes itself while open. */
const REFRESH_MS = 30_000;

const status = useAsyncData<SystemStatusDto | null>(getSystemStatus, null);
let timer: number | undefined;

const LABELS: Record<SystemCheckDto["id"], string> = {
  database: "Database",
  storage: "Data disk",
  "tak-server": "TAK server",
  "tak-certificate": "TAK server certificate",
  errors: "Errors",
};
const icons: Record<SystemCheckState, string> = {
  ok: mdiCheckCircleOutline,
  warning: mdiAlertCircleOutline,
  error: mdiCloseCircleOutline,
  off: mdiMinusCircleOutline,
};
const colors: Record<SystemCheckState, string> = { ok: "success", warning: "warning", error: "error", off: "medium-emphasis" };

function bytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unknown";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${String(Math.round(value / 1024))} KB`;
}

function uptime(startedAt: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(startedAt)) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days > 0 ? `${String(days)} d ${String(hours)} h` : `${String(hours)} h ${String(minutes % 60)} min`;
}

const numbers = computed(() => {
  const value = status.data.value;
  if (value === null) return [];
  return [
    { label: "Version", text: value.version },
    { label: "Running for", text: uptime(value.startedAt) },
    { label: "Active events", text: String(value.activeEvents) },
    { label: "Connected TAK apps", text: String(value.takConnections) },
    { label: "Database", text: bytes(value.databaseBytes) },
    { label: "Stored files", text: bytes(value.storedFileBytes) },
    {
      label: "Data disk",
      text: value.diskFreeBytes === null ? "Unknown" : `${bytes(value.diskFreeBytes)} free of ${bytes(value.diskTotalBytes)}`,
    },
    { label: "Memory in use", text: bytes(value.memoryBytes) },
  ];
});

function percent(value: number): string {
  return `${String(Math.round(value))} %`;
}

function count(value: number): string {
  return String(Math.round(value));
}

/** A scale top in whole megabytes: 1, 2 or 5 times a power of ten. */
function roundMegabytes(values: number[]): number {
  const megabytes = Math.max(...values, 1) / 1024 ** 2;
  const power = 10 ** Math.floor(Math.log10(megabytes));
  return ([1, 2, 5, 10].find((step) => step * power >= megabytes) ?? 10) * power * 1024 ** 2;
}

/** One chart per measure; memory charts share neither scale nor axis with the CPU charts. */
const charts = computed(() => {
  const history = status.data.value?.history ?? [];
  const series = (pick: (sample: (typeof history)[number]) => number) => history.map((sample) => ({ time: sample.time, value: pick(sample) }));
  const totalMemory = history.at(-1)?.systemMemoryTotalBytes;
  // In Docker the system values are the container's, measured against its limits.
  const machine = status.data.value?.metricScope === "container" ? "Container" : "Server";
  return [
    { title: "OpenMeshTak CPU", points: series((sample) => sample.coreCpuPercent), format: percent, max: 100, suffix: undefined },
    { title: `${machine} CPU`, points: series((sample) => sample.systemCpuPercent), format: percent, max: 100, suffix: undefined },
    { title: "Connected TAK apps", points: series((sample) => sample.takConnections), format: count, max: undefined, suffix: undefined },
    { title: "OpenMeshTak memory", points: series((sample) => sample.coreMemoryBytes), format: bytes, max: roundMegabytes(history.map((sample) => sample.coreMemoryBytes)), suffix: undefined },
    {
      title: `${machine} memory`,
      points: series((sample) => sample.systemMemoryUsedBytes),
      format: bytes,
      max: totalMemory,
      suffix: totalMemory === undefined ? undefined : `of ${bytes(totalMemory)}`,
    },
  ];
});

function refresh(): void {
  // A failed refresh keeps the last status instead of blanking the page.
  void getSystemStatus().then(
    (value) => {
      status.data.value = value;
    },
    () => undefined,
  );
}

onMounted(async () => {
  await status.load();
  timer = window.setInterval(refresh, REFRESH_MS);
});
onUnmounted(() => {
  window.clearInterval(timer);
});
</script>

<template>
  <div>
    <ViewHeader title="System status" subtitle="Health of this installation, refreshed every 30 seconds.">
      <template #actions>
        <v-btn :prepend-icon="mdiRefresh" variant="text" :loading="status.state.value === 'loading'" @click="status.load">Refresh</v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="status.state.value === 'loading' && status.data.value === null" type="list-item-two-line@4" />
    <ErrorState v-else-if="status.state.value === 'error'" :message="status.error.value" @retry="status.load" />

    <template v-else-if="status.data.value !== null">
      <v-card class="mb-3 px-4 py-3">
        <v-row dense>
          <v-col v-for="check in status.data.value.checks" :key="check.id" cols="12" sm="6" xl="4" class="d-flex ga-3 align-start">
            <v-icon :icon="icons[check.state]" :color="colors[check.state]" size="20" class="mt-1" />
            <div class="min-width-0">
              <div class="text-title-small">{{ LABELS[check.id] }}</div>
              <div class="text-body-small text-medium-emphasis">{{ check.detail }}</div>
              <div v-if="check.id === 'errors' && status.data.value.lastError" class="text-body-small text-truncate">
                {{ status.data.value.lastError.message }} ·
                <router-link :to="{ name: 'server-log' }">Server log</router-link>
              </div>
            </div>
          </v-col>
        </v-row>
      </v-card>

      <v-card class="mb-3 px-4 py-3">
        <v-row dense>
          <v-col v-for="row in numbers" :key="row.label" cols="6" sm="4" lg="3">
            <div class="text-body-small text-medium-emphasis">{{ row.label }}</div>
            <div class="text-body-medium">{{ row.text }}</div>
          </v-col>
        </v-row>
      </v-card>

      <div class="d-flex align-center mb-2">
        <div class="text-title-small">Last six hours</div>
        <InfoHint
          label="About the graphs"
          :text="`One value every ${status.data.value.sampleIntervalSeconds} seconds since the server started; a restart starts the graphs again. In a Docker container, CPU and memory are the container's, measured against its limits.`"
        />
      </div>
      <v-row dense>
        <v-col v-for="chart in charts" :key="chart.title" cols="12" sm="6" lg="4" xl>
          <v-card class="px-4 pt-3 pb-2 h-100">
            <MetricChart :title="chart.title" :points="chart.points" :format="chart.format" :max="chart.max" :suffix="chart.suffix" />
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
