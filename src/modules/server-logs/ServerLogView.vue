<script setup lang="ts">
import {
  mdiArrowDown,
  mdiContentCopy,
  mdiDeleteSweepOutline,
  mdiDownload,
  mdiMagnify,
  mdiPause,
  mdiPlay,
} from "@mdi/js";
import { computed, nextTick, ref, watch } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useToast } from "@/shared/feedback/toast";
import type { ServerLogEntryDto, ServerLogLevel } from "./server-logs.api";
import { useServerLogStream } from "./useServerLogStream";

/**
 * Live console of OpenMeshTak Core: the same sanitized lines as the container log, newest at the
 * bottom. The view follows new lines until the reader scrolls up.
 */
const { entries, held, status, error, paused, pause, resume, clear } = useServerLogStream();

type Filter = "debug" | "info" | "warn" | "error";

const LEVELS: Record<ServerLogLevel, { tag: string; label: string; filter: Filter }> = {
  trace: { tag: "TRACE", label: "Trace", filter: "debug" },
  debug: { tag: "DEBUG", label: "Debug", filter: "debug" },
  info: { tag: "INFO", label: "Info", filter: "info" },
  warn: { tag: "WARN", label: "Warning", filter: "warn" },
  error: { tag: "ERROR", label: "Error", filter: "error" },
  fatal: { tag: "FATAL", label: "Fatal", filter: "error" },
};

const FILTERS: Array<{ value: Filter; label: string; color: string }> = [
  { value: "debug", label: "Debug", color: "#8b949e" },
  { value: "info", label: "Info", color: "#58a6ff" },
  { value: "warn", label: "Warning", color: "#e3b341" },
  { value: "error", label: "Error", color: "#ff7b72" },
];

const shownLevels = ref<Filter[]>(["debug", "info", "warn", "error"]);
const search = ref("");
const expanded = ref(new Set<number>());
const console = ref<HTMLElement | null>(null);
const following = ref(true);

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();
  return entries.value.filter(
    (entry) =>
      shownLevels.value.includes(LEVELS[entry.level].filter) &&
      (query === "" || entry.message.toLowerCase().includes(query) || (entry.details?.toLowerCase().includes(query) ?? false)),
  );
});

const counts = computed(() => {
  const result: Record<Filter, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const entry of entries.value) {
    result[LEVELS[entry.level].filter] += 1;
  }
  return result;
});

const statusLabel = computed(
  () =>
    ({
      connecting: "Connecting",
      live: paused.value ? "Paused" : "Live",
      reconnecting: "Reconnecting",
      denied: "No access",
      error: "Error",
    })[status.value],
);

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

function timeOf(entry: ServerLogEntryDto): string {
  return entry.time === null ? "" : timeFormat.format(new Date(entry.time));
}

function fullTimeOf(entry: ServerLogEntryDto): string {
  return entry.time === null ? "" : dateFormat.format(new Date(entry.time));
}

function prettyDetails(details: string): string {
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

function toggle(sequence: number): void {
  const next = new Set(expanded.value);
  if (!next.delete(sequence)) {
    next.add(sequence);
  }
  expanded.value = next;
}

function onScroll(): void {
  const element = console.value;
  if (element !== null) {
    following.value = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
  }
}

function scrollToLatest(): void {
  const element = console.value;
  if (element !== null) {
    element.scrollTop = element.scrollHeight;
    following.value = true;
  }
}

watch(
  () => visible.value.length,
  async () => {
    if (following.value) {
      await nextTick();
      scrollToLatest();
    }
  },
);

const toast = useToast();

function asText(lines: ServerLogEntryDto[]): string {
  return lines.map((entry) => [entry.time ?? "", entry.level.toUpperCase(), entry.message, entry.details ?? ""].join(" ").trim()).join("\n");
}

async function copyLines(lines: ServerLogEntryDto[]): Promise<void> {
  try {
    await navigator.clipboard.writeText(asText(lines));
    toast.success(lines.length === 1 ? "Line copied." : `${String(lines.length)} lines copied.`);
  } catch {
    toast.error("The browser did not allow copying to the clipboard.");
  }
}

function download(): void {
  const text = asText(visible.value);
  const url = URL.createObjectURL(new Blob([`${text}\n`], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `openmeshtak-server-${new Date().toISOString().replaceAll(":", "-")}.log`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div>
    <ViewHeader title="Server log" subtitle="Live output of OpenMeshTak Core, with secrets removed like in the container log.">
      <template #actions>
        <div class="stream-status" :class="`stream-status--${paused && status === 'live' ? 'paused' : status}`">
          <span class="stream-status__dot" />
          {{ statusLabel }}
        </div>
        <v-btn
          variant="tonal"
          :prepend-icon="paused ? mdiPlay : mdiPause"
          :disabled="status === 'denied' || status === 'error'"
          @click="paused ? resume() : pause()"
        >
          {{ paused ? `Resume${held.length > 0 ? ` (${held.length})` : ""}` : "Pause" }}
        </v-btn>
        <v-btn variant="text" :prepend-icon="mdiContentCopy" :disabled="visible.length === 0" @click="copyLines(visible)">Copy</v-btn>
        <v-btn variant="text" :prepend-icon="mdiDownload" :disabled="visible.length === 0" @click="download">Download</v-btn>
        <v-btn variant="text" :prepend-icon="mdiDeleteSweepOutline" :disabled="entries.length === 0" @click="clear">Clear</v-btn>
      </template>
    </ViewHeader>

    <ErrorState v-if="status === 'error'" :message="error" />
    <ErrorState v-else-if="status === 'denied'" message="Your account cannot read the server log." />

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-3 mb-3">
        <v-chip-group v-model="shownLevels" multiple selected-class="level-filter--on" class="py-0">
          <v-chip
            v-for="filter in FILTERS"
            :key="filter.value"
            :value="filter.value"
            :color="filter.color"
            class="level-filter"
            variant="tonal"
            label
          >
            {{ filter.label }}
            <span class="level-filter__count">{{ counts[filter.value] }}</span>
          </v-chip>
        </v-chip-group>
        <v-spacer />
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          placeholder="Search messages and details"
          density="compact"
          hide-details
          clearable
          class="log-search"
        />
      </div>

      <div class="log-console">
        <div ref="console" class="log-body" @scroll="onScroll">
          <div v-if="status === 'connecting'" class="log-note">Connecting to the server…</div>
          <div v-else-if="visible.length === 0" class="log-note">
            {{ entries.length === 0 ? "Waiting for log lines…" : "No line matches the filter." }}
          </div>
          <div
            v-for="entry in visible"
            :key="entry.sequence"
            class="log-line"
            :class="[`log-line--${LEVELS[entry.level].filter}`, { 'log-line--open': expanded.has(entry.sequence) }]"
            @click="toggle(entry.sequence)"
          >
            <span class="log-time" :title="fullTimeOf(entry)">{{ timeOf(entry) }}</span>
            <span class="log-level">{{ LEVELS[entry.level].tag }}</span>
            <span class="log-text">
              {{ entry.message }}<span v-if="entry.details && !expanded.has(entry.sequence)" class="log-details">{{ entry.details }}</span>
            </span>
            <button type="button" class="log-copy" aria-label="Copy this line" title="Copy this line" @click.stop="copyLines([entry])">
              <v-icon :icon="mdiContentCopy" size="14" />
            </button>
            <pre v-if="entry.details && expanded.has(entry.sequence)" class="log-details--open">{{ prettyDetails(entry.details) }}</pre>
          </div>
          <div v-if="status === 'live' && !paused" class="log-cursor">▍</div>
        </div>
        <v-btn v-if="!following && visible.length > 0" class="log-jump" size="small" :prepend-icon="mdiArrowDown" @click="scrollToLatest">
          Latest
        </v-btn>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stream-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.stream-status__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9aa4b2;
}

.stream-status--live .stream-status__dot {
  background: #3fb950;
  box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.6);
  animation: pulse 2s infinite;
}

.stream-status--paused .stream-status__dot,
.stream-status--reconnecting .stream-status__dot {
  background: #d29922;
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 6px rgba(63, 185, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(63, 185, 80, 0);
  }
}

/* Switched-off levels fade out instead of showing a check mark. */
.level-filter:not(.level-filter--on) {
  opacity: 0.4;
}

.level-filter {
  font-weight: 600;
}

.level-filter__count {
  margin-left: 6px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.log-search {
  max-width: 320px;
  min-width: 220px;
}

/* A terminal stays dark in both themes, like the consoles operators know. */
.log-console {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #263040;
  background: #0d1117;
  color: #c9d1d9;
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
}

.log-body {
  height: calc(100vh - 290px);
  min-height: 360px;
  overflow-y: auto;
  padding: 10px 0;
}

.log-line {
  display: grid;
  grid-template-columns: max-content 8ch minmax(0, 1fr) 24px;
  cursor: pointer;
  column-gap: 12px;
  padding: 0 16px;
}

.log-line:hover,
.log-line--open {
  background: rgba(110, 118, 129, 0.12);
}

.log-time {
  color: #6e7681;
  font-variant-numeric: tabular-nums;
}

.log-level {
  align-self: start;
  margin-top: 2px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 18px;
  letter-spacing: 0.03em;
  text-align: center;
}

/* One line per entry; a click shows the whole message and its details. */
.log-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-line--open .log-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.log-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: start;
  width: 24px;
  height: 20px;
  margin-top: 1px;
  border-radius: 4px;
  color: #8b949e;
  opacity: 0;
}

.log-line:hover .log-copy,
.log-line--open .log-copy,
.log-copy:focus-visible {
  opacity: 1;
}

.log-copy:hover {
  color: #e6edf3;
  background: rgba(110, 118, 129, 0.25);
}

.log-details {
  margin-left: 1ch;
  color: #6e7681;
}

.log-line--debug .log-level {
  color: #b1bac4;
  background: rgba(139, 148, 158, 0.2);
}

.log-line--debug .log-text {
  color: #8b949e;
}

.log-line--info .log-level {
  color: #79c0ff;
  background: rgba(56, 139, 253, 0.2);
}

.log-line--warn .log-level {
  color: #0d1117;
  background: #e3b341;
}

.log-line--warn .log-text {
  color: #e3b341;
}

.log-line--error .log-level {
  color: #ffffff;
  background: #da3633;
}

.log-line--error .log-text {
  color: #ff7b72;
}

.log-line--error {
  background: rgba(248, 81, 73, 0.08);
}

.log-details--open {
  grid-column: 3 / span 2;
  margin: 2px 0 6px;
  padding: 8px 12px;
  border-left: 2px solid #30363d;
  color: #a5b3c4;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.log-note {
  padding: 0 16px;
  color: #6e7681;
}

.log-cursor {
  padding: 0 16px;
  color: #3fb950;
  animation: blink 1.1s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.log-jump {
  position: absolute;
  right: 16px;
  bottom: 16px;
}

@media (max-width: 699px) {
  .log-line {
    grid-template-columns: 8ch minmax(0, 1fr) 24px;
  }

  .log-time {
    display: none;
  }

  .log-details--open {
    grid-column: 2 / span 2;
  }
}
</style>
