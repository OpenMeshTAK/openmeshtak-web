<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiCloseCircleOutline, mdiMinusCircleOutline, mdiRefresh } from "@mdi/js";
import { computed, onMounted, onUnmounted } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
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

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

function bytes(value: number | null): string {
  if (value === null) return "Unknown";
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
    { label: "Running since", text: `${dateTime.format(new Date(value.startedAt))} (${uptime(value.startedAt)})` },
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
      <v-card class="mb-4">
        <v-list density="compact" class="py-1">
          <v-list-item v-for="check in status.data.value.checks" :key="check.id" :title="LABELS[check.id]" lines="two">
            <template #prepend>
              <v-icon :icon="icons[check.state]" :color="colors[check.state]" />
            </template>
            <v-list-item-subtitle>{{ check.detail }}</v-list-item-subtitle>
            <v-list-item-subtitle v-if="check.id === 'errors' && status.data.value.lastError" class="mt-1">
              Newest<span v-if="status.data.value.lastError.time"> ({{ dateTime.format(new Date(status.data.value.lastError.time)) }})</span>:
              {{ status.data.value.lastError.message }} ·
              <router-link :to="{ name: 'server-log' }">Server log</router-link>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card>
        <v-table density="compact">
          <tbody>
            <tr v-for="row in numbers" :key="row.label">
              <td class="text-medium-emphasis">{{ row.label }}</td>
              <td>{{ row.text }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>
  </div>
</template>
