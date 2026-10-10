<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiCloseCircleOutline, mdiMinusCircleOutline, mdiRefresh } from "@mdi/js";
import { computed, onMounted, onUnmounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import MetricChart from "./MetricChart.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { getSystemStatus, type LoggedProblemDto, type SystemCheckDto, type SystemCheckState, type SystemStatusDto } from "./system-status.api";

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

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" });
/** Opened rows by time and message, so a refresh keeps them open. */
const expanded = ref(new Set<string>());

function problemKey(problem: LoggedProblemDto): string {
  return `${problem.time ?? ""}|${problem.message}`;
}

function toggle(problem: LoggedProblemDto): void {
  const key = problemKey(problem);
  const next = new Set(expanded.value);
  if (!next.delete(key)) next.add(key);
  expanded.value = next;
}

function problemColor(level: LoggedProblemDto["level"]): string {
  return level === "warn" ? "warning" : "error";
}

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

      <div class="d-flex align-center mt-4 mb-2">
        <div class="text-title-small">Warnings and errors</div>
        <InfoHint
          label="About stored warnings and errors"
          text="Warnings and errors are also stored in the data directory, so they survive a restart or crash. The last seven days are shown, newest first. The full live log is under Server log."
        />
      </div>
      <v-card>
        <div v-if="status.data.value.problems.length === 0" class="px-4 py-3 text-body-medium text-medium-emphasis">
          No warnings or errors in the last seven days.
        </div>
        <v-list v-else density="compact" class="py-0 problems">
          <template v-for="problem in status.data.value.problems" :key="problemKey(problem)">
            <v-list-item class="px-4" @click="toggle(problem)">
              <div class="d-flex ga-3 align-baseline">
                <span class="text-body-small text-medium-emphasis problem__time">{{ problem.time ? dateTime.format(new Date(problem.time)) : "" }}</span>
                <span class="text-body-small font-weight-medium problem__level" :class="`text-${problemColor(problem.level)}`">
                  {{ problem.level.toUpperCase() }}
                </span>
                <span class="text-body-medium text-truncate">{{ problem.message }}</span>
              </div>
              <pre v-if="expanded.has(problemKey(problem)) && problem.details" class="problem__details text-body-small mt-1">{{ problem.details }}</pre>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </template>
  </div>
</template>

<style scoped>
.problems {
  max-height: 360px;
  overflow-y: auto;
}
.problem__time {
  flex: 0 0 auto;
  min-width: 96px;
}
.problem__level {
  flex: 0 0 48px;
}
.problem__details {
  white-space: pre-wrap;
  word-break: break-all;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
