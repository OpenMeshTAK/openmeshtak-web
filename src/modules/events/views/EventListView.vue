<script setup lang="ts">
import {
  mdiAccessPointNetwork,
  mdiAccountGroup,
  mdiCalendarBlank,
  mdiCalendarPlus,
  mdiCog,
  mdiMagnify,
  mdiMapLegend,
  mdiPackageVariantClosed,
  mdiRadioTower,
} from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSession } from "@/modules/auth/session";
import CreateEventDialog from "../components/CreateEventDialog.vue";
import EventStatusBadge from "../components/EventStatusBadge.vue";
import { scheduleHint } from "../event-schedule";
import { listAllEvents, type EventDto, type EventListItem } from "../events.api";

type StatusFilter = "all" | EventDto["status"];

const router = useRouter();
const session = useSession();
const events = useAsyncData(listAllEvents, [] as EventListItem[]);
const createOpen = ref(false);
const search = ref("");
const status = ref<StatusFilter>("all");
/** Unpublished changes or unresolved sync issues: things an organizer has to act on. */
const attentionOnly = ref(false);

function needsAttention(event: EventListItem): boolean {
  return event.overview.unpublishedChanges || event.overview.openSyncIssueCount > 0;
}
const attentionCount = computed(() => events.data.value.filter(needsAttention).length);

const statusOptions = computed(() => {
  const count = (value: EventDto["status"]): number => events.data.value.filter((event) => event.status === value).length;
  return [
    { value: "all", title: `All statuses (${String(events.data.value.length)})` },
    { value: "active", title: `Active (${String(count("active"))})` },
    { value: "draft", title: `Draft (${String(count("draft"))})` },
    { value: "archived", title: `Archived (${String(count("archived"))})` },
  ];
});

const headers = [
  { title: "Name", key: "name" },
  { title: "Status", key: "status" },
  { title: "Published", key: "published", value: (event: EventListItem) => event.overview.publishedRevision ?? -1 },
  { title: "Members", key: "members", value: (event: EventListItem) => event.overview.memberCount, align: "end" as const },
  { title: "Sync issues", key: "issues", value: (event: EventListItem) => event.overview.openSyncIssueCount, align: "end" as const },
  { title: "Dates", key: "startsAt" },
  { title: "Updated", key: "updatedAt" },
  { title: "", key: "actions", sortable: false, align: "end" as const },
];

/** Status sorts by lifecycle (active, draft, archived) and dates by time; missing dates last. */
const STATUS_ORDER: Record<EventDto["status"], number> = { active: 0, draft: 1, archived: 2 };
const byDate = (a: string | null, b: string | null): number =>
  (a === null ? Number.POSITIVE_INFINITY : Date.parse(a)) - (b === null ? Number.POSITIVE_INFINITY : Date.parse(b)) || 0;
const sortKeys = {
  status: (a: EventDto["status"], b: EventDto["status"]) => STATUS_ORDER[a] - STATUS_ORDER[b],
  startsAt: byDate,
  updatedAt: byDate,
};
const sortBy = ref([{ key: "status", order: "asc" as const }]);

const rows = computed(() => {
  const text = (search.value ?? "").trim().toLowerCase();
  return events.data.value.filter(
    (event) =>
      (status.value === "all" || event.status === status.value) &&
      (!attentionOnly.value || needsAttention(event)) &&
      (text === "" || event.name.toLowerCase().includes(text) || event.slug.includes(text)),
  );
});

/** Dates in the event's own time zone, so organizers everywhere see the same days. */
function eventDates(event: EventDto): string {
  const format = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: event.timeZone });
  const start = event.startsAt === null ? null : new Date(event.startsAt);
  const end = event.endsAt === null ? null : new Date(event.endsAt);
  if (start !== null && end !== null) {
    return format.formatRange(start, end);
  }
  if (start !== null || end !== null) {
    return start !== null ? `From ${format.format(start)}` : `Until ${format.format(end ?? new Date())}`;
  }
  return "—";
}

const updatedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

interface QuickLink {
  label: string;
  icon: string;
  to: RouteLocationRaw;
}

/** Shortcuts at the end of each row; each one only appears with the permission its page needs. */
function quickLinks(event: EventDto): QuickLink[] {
  const tab = (name: string): RouteLocationRaw => ({ name: "event-detail", params: { eventId: event.id, tab: name } });
  const links: QuickLink[] = [{ label: "Members", icon: mdiAccountGroup, to: tab("members") }];
  if (session.can("data-packages.read", event.id)) {
    links.push(
      { label: "Data packages", icon: mdiPackageVariantClosed, to: tab("data-packages") },
      { label: "Map editor", icon: mdiMapLegend, to: { name: "event-editor", params: { eventId: event.id } } },
    );
  }
  links.push({ label: "Meshtastic", icon: mdiRadioTower, to: tab("meshtastic") });
  if (event.status === "active" && session.can("tak-traffic.view", event.id)) {
    links.push({ label: "Live TAK", icon: mdiAccessPointNetwork, to: { name: "event-live", params: { eventId: event.id } } });
  }
  links.push({ label: "Settings", icon: mdiCog, to: tab("settings") });
  return links;
}

function open(event: EventDto): void {
  void router.push({ name: "event-detail", params: { eventId: event.id } });
}

onMounted(events.load);
</script>

<template>
  <ViewContent>
    <ViewHeader title="Events" subtitle="Create events as drafts, configure them, then activate.">
      <template #actions>
        <v-btn v-if="session.can('events.manage')" color="primary" :prepend-icon="mdiCalendarPlus" @click="createOpen = true">
          New event
        </v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="events.state.value === 'loading'" type="table" />
    <ErrorState v-else-if="events.state.value === 'error'" :message="events.error.value" @retry="events.load" />
    <EmptyState
      v-else-if="events.data.value.length === 0"
      :icon="mdiCalendarBlank"
      title="No events yet"
      text="Create a draft event, configure it, then activate it for participants."
    >
      <v-btn v-if="session.can('events.manage')" color="primary" :prepend-icon="mdiCalendarPlus" @click="createOpen = true">
        New event
      </v-btn>
    </EmptyState>

    <template v-else>
      <div class="event-filters mb-4">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          label="Search events"
          density="compact"
          hide-details
          clearable
          class="event-filters__search"
        />
        <v-select v-model="status" :items="statusOptions" label="Status" density="compact" hide-details class="event-filters__status" />
        <v-switch
          v-model="attentionOnly"
          :label="`Needs attention (${String(attentionCount)})`"
          color="primary"
          density="compact"
          hide-details
          inset
        />
      </div>

      <v-card>
        <v-data-table
          v-model:sort-by="sortBy"
          :headers="headers"
          :items="rows"
          :custom-key-sort="sortKeys"
          item-value="id"
          hover
          mobile-breakpoint="sm"
          :items-per-page="-1"
          hide-default-footer
          no-data-text="No events match the filters."
          @click:row="(_: unknown, { item }: { item: EventDto }) => open(item)"
        >
          <template #[`item.name`]="{ item }">
            <router-link :to="{ name: 'event-detail', params: { eventId: item.id } }" class="event-link" @click.stop>
              <div class="font-weight-medium text-break">{{ item.name }}</div>
              <div class="text-body-small text-medium-emphasis">{{ item.slug }}</div>
            </router-link>
          </template>
          <template #[`item.status`]="{ item }">
            <EventStatusBadge :status="item.status" />
          </template>
          <template #[`item.published`]="{ item }">
            <span v-if="item.overview.publishedRevision === null" class="text-medium-emphasis">—</span>
            <span v-else class="text-no-wrap">
              Revision {{ item.overview.publishedRevision }}
              <span v-if="item.overview.unpublishedChanges" class="text-warning"> · Changes pending</span>
            </span>
          </template>
          <template #[`item.members`]="{ item }">{{ item.overview.memberCount }}</template>
          <template #[`item.issues`]="{ item }">
            <span :class="item.overview.openSyncIssueCount > 0 ? 'text-error font-weight-medium' : 'text-medium-emphasis'">
              {{ item.overview.openSyncIssueCount }}
            </span>
          </template>
          <template #[`item.startsAt`]="{ item }">
            <span class="text-no-wrap">{{ eventDates(item) }}</span>
            <span v-if="item.status !== 'archived' && scheduleHint(item)" class="text-medium-emphasis"> · {{ scheduleHint(item) }}</span>
          </template>
          <template #[`item.updatedAt`]="{ item }">
            <span class="text-medium-emphasis">{{ updatedFormat.format(new Date(item.updatedAt)) }}</span>
          </template>
          <template #[`item.actions`]="{ item }">
            <div class="text-no-wrap">
              <v-btn
                v-for="link in quickLinks(item)"
                :key="link.label"
                v-tooltip:top="link.label"
                :to="link.to"
                :icon="link.icon"
                :aria-label="link.label"
                variant="text"
                size="small"
                @click.stop
              />
            </div>
          </template>
        </v-data-table>
      </v-card>
    </template>

    <CreateEventDialog v-model="createOpen" @created="open" />
  </ViewContent>
</template>

<style scoped>
.event-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.event-filters__search {
  flex: 0 1 360px;
  min-width: 200px;
}

.event-filters__status {
  flex: 0 1 220px;
  min-width: 180px;
}

.event-link {
  display: block;
  padding-block: 6px;
  color: inherit;
  text-decoration: none;
}

.event-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

:deep(tbody tr) {
  cursor: pointer;
}

@media (max-width: 599px) {
  .event-filters__search,
  .event-filters__status {
    flex-basis: 100%;
  }
}
</style>
