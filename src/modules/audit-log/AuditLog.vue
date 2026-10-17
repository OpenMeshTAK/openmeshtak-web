<script setup lang="ts">
import { mdiContentCopy, mdiDownload, mdiMagnify, mdiRefresh } from "@mdi/js";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { listAuditEvents, type AuditEventDto, type AuditLogScope, type AuditResult } from "./audit-log.api";

/**
 * The audit log in the same console as the server log, newest at the bottom. Filters run in Core,
 * so they cover the whole log and not only the loaded entries; older entries load on request.
 */
const props = defineProps<{ scope: AuditLogScope }>();

const RESULTS: Array<{ value: AuditResult; label: string; color: string }> = [
  { value: "success", label: "Success", color: "#3fb950" },
  { value: "failure", label: "Failure", color: "#ff7b72" },
];

const entries = ref<AuditEventDto[]>([]);
const nextCursor = ref<string | null>(null);
const state = ref<"loading" | "ready" | "denied" | "error">("loading");
const loadingMore = ref(false);
const error = ref("");
const shownResults = ref<AuditResult[]>(["success", "failure"]);
const search = ref("");
const expanded = ref(new Set<string>());
const body = ref<HTMLElement | null>(null);
let request = 0;

const resultFilter = computed(() => (shownResults.value.length === 1 ? shownResults.value[0] : undefined));

async function load(more = false): Promise<void> {
  const current = ++request;
  if (more) {
    loadingMore.value = true;
  } else {
    state.value = "loading";
  }
  try {
    const page = await listAuditEvents(props.scope, {
      search: search.value.trim(),
      ...(resultFilter.value ? { result: resultFilter.value } : {}),
      ...(more && nextCursor.value ? { cursor: nextCursor.value } : {}),
    });
    if (current !== request) return;
    // Core pages newest first; the console reads like the server log, oldest at the top.
    const older = [...page.items].reverse();
    const element = body.value;
    const fromBottom = element === null ? 0 : element.scrollHeight - element.scrollTop;
    entries.value = more ? [...older, ...entries.value] : older;
    nextCursor.value = page.page.nextCursor;
    state.value = "ready";
    await nextTick();
    // A fresh load shows the newest entries; older ones added above keep the reader's place.
    if (body.value !== null) {
      body.value.scrollTop = more ? body.value.scrollHeight - fromBottom : body.value.scrollHeight;
    }
    loadOlderIfAtTop();
  } catch (caught: unknown) {
    if (current !== request) return;
    error.value = describeError(caught);
    state.value = isApiProblem(caught) && caught.status === 403 ? "denied" : "error";
  } finally {
    if (current === request) loadingMore.value = false;
  }
}

/**
 * Older entries load by themselves once the reader scrolls near the top, and also while the
 * loaded entries do not yet fill the console, since it then cannot scroll at all.
 */
function loadOlderIfAtTop(): void {
  const element = body.value;
  if (element === null || state.value !== "ready" || loadingMore.value || nextCursor.value === null) return;
  if (element.scrollTop < 80 || element.scrollHeight <= element.clientHeight) {
    void load(true);
  }
}

/** Both results off shows nothing; Core is not asked for that. */
const visible = computed(() => (shownResults.value.length === 0 ? [] : entries.value));

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(), 300);
});
watch([() => JSON.stringify(props.scope), resultFilter], () => void load(), { immediate: true });
onBeforeUnmount(() => clearTimeout(searchTimer));

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" });

function actorOf(entry: AuditEventDto): string {
  if (entry.actor.type === "system") return "System";
  if (entry.actor.type === "anonymous") return "Anonymous";
  return entry.actor.name ?? (entry.actor.type === "api_client" ? "Removed API client" : "Removed user");
}

function targetOf(entry: AuditEventDto): string {
  return entry.targetId === null ? entry.targetType : `${entry.targetType} ${entry.targetId}`;
}

function detailsOf(entry: AuditEventDto): string {
  return JSON.stringify(
    {
      actor: entry.actor,
      target: { type: entry.targetType, id: entry.targetId },
      event: entry.eventId === null ? null : { id: entry.eventId, name: entry.eventName },
      traceId: entry.traceId,
      metadata: entry.metadata,
    },
    null,
    2,
  );
}

function toggle(id: string): void {
  const next = new Set(expanded.value);
  if (!next.delete(id)) next.add(id);
  expanded.value = next;
}

function asText(lines: AuditEventDto[]): string {
  return lines
    .map((entry) =>
      [entry.occurredAt, entry.result.toUpperCase(), entry.action, actorOf(entry), targetOf(entry), entry.eventName ?? "", entry.metadata ? JSON.stringify(entry.metadata) : ""]
        .join(" ")
        .trim(),
    )
    .join("\n");
}

const toast = useToast();

async function copyLines(lines: AuditEventDto[]): Promise<void> {
  try {
    await navigator.clipboard.writeText(asText(lines));
    toast.success(lines.length === 1 ? "Entry copied." : `${String(lines.length)} entries copied.`);
  } catch {
    toast.error("The browser did not allow copying to the clipboard.");
  }
}

function download(): void {
  const url = URL.createObjectURL(new Blob([`${asText(visible.value)}\n`], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `openmeshtak-audit-${new Date().toISOString().replaceAll(":", "-")}.log`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div>
    <ErrorState v-if="state === 'denied'" message="Your account cannot read this audit log." />
    <ErrorState v-else-if="state === 'error'" :message="error" />

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-3 mb-3">
        <slot name="scope" />
        <v-chip-group v-model="shownResults" multiple selected-class="result-filter--on" class="py-0">
          <v-chip v-for="filter in RESULTS" :key="filter.value" :value="filter.value" :color="filter.color" class="result-filter" variant="tonal">
            {{ filter.label }}
          </v-chip>
        </v-chip-group>
        <v-spacer />
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          placeholder="Search action or target"
          density="compact"
          hide-details
          clearable
          class="log-search"
        />
        <v-btn variant="text" :prepend-icon="mdiRefresh" :loading="state === 'loading'" @click="load()">Refresh</v-btn>
        <v-btn variant="text" :prepend-icon="mdiContentCopy" :disabled="visible.length === 0" @click="copyLines(visible)">Copy</v-btn>
        <v-btn variant="text" :prepend-icon="mdiDownload" :disabled="visible.length === 0" @click="download">Download</v-btn>
      </div>

      <div class="log-console">
        <div ref="body" class="log-body" @scroll="loadOlderIfAtTop">
          <div v-if="state === 'ready' && nextCursor !== null" class="log-note">
            {{ loadingMore ? "Loading older entries…" : "Scroll up for older entries" }}
          </div>
          <div v-else-if="state === 'ready' && entries.length > 0" class="log-note">Start of the audit log</div>
          <div v-if="state === 'loading'" class="log-note">Loading the audit log…</div>
          <div v-else-if="visible.length === 0" class="log-note">No entry matches the filter.</div>
          <div
            v-for="entry in visible"
            :key="entry.id"
            class="log-line"
            :class="[`log-line--${entry.result}`, { 'log-line--open': expanded.has(entry.id) }]"
            @click="toggle(entry.id)"
          >
            <span class="log-time">{{ timeFormat.format(new Date(entry.occurredAt)) }}</span>
            <span class="log-level">{{ entry.result === "success" ? "OK" : "FAIL" }}</span>
            <span class="log-text">
              {{ entry.action }}<span class="log-actor">{{ actorOf(entry) }}</span><span class="log-details">{{ targetOf(entry) }}</span>
              <span v-if="entry.eventName && typeof scope !== 'object'" class="log-event">{{ entry.eventName }}</span>
            </span>
            <button type="button" class="log-copy" aria-label="Copy this entry" title="Copy this entry" @click.stop="copyLines([entry])">
              <v-icon :icon="mdiContentCopy" size="14" />
            </button>
            <pre v-if="expanded.has(entry.id)" class="log-details--open">{{ detailsOf(entry) }}</pre>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.result-filter {
  font-weight: 600;
}

/* Switched-off results fade out instead of showing a check mark. */
.result-filter:not(.result-filter--on) {
  opacity: 0.4;
}

.log-search {
  max-width: 320px;
  min-width: 220px;
}

/* The same terminal as the server log, dark in both themes. */
.log-console {
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
  grid-template-columns: max-content 6ch minmax(0, 1fr) 24px;
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

.log-line--success .log-level {
  color: #7ee787;
  background: rgba(63, 185, 80, 0.2);
}

.log-line--failure .log-level {
  color: #ffffff;
  background: #da3633;
}

.log-line--failure {
  background: rgba(248, 81, 73, 0.08);
}

.log-line--failure .log-text {
  color: #ff7b72;
}

/* One line per entry; a click shows actor, target, event, trace ID and metadata. */
.log-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-actor {
  margin-left: 1ch;
  color: #79c0ff;
}

.log-details {
  margin-left: 1ch;
  color: #6e7681;
}

.log-event {
  margin-left: 1ch;
  color: #d2a8ff;
}

.log-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: start;
  width: 24px;
  height: 20px;
  margin-top: 1px;
  border: 0;
  border-radius: 4px;
  outline: none;
  color: #8b949e;
  background: transparent;
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

.log-copy:focus-visible {
  color: #e6edf3;
  box-shadow: 0 0 0 1px #58a6ff;
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


@media (max-width: 699px) {
  .log-line {
    grid-template-columns: 6ch minmax(0, 1fr) 24px;
  }

  .log-time {
    display: none;
  }

  .log-details--open {
    grid-column: 2 / span 2;
  }
}
</style>
