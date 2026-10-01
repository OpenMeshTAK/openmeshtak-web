<script setup lang="ts">
import { mdiCalendarBlank, mdiCalendarPlus, mdiMagnify } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSession } from "@/modules/auth/session";
import CreateEventDialog from "../components/CreateEventDialog.vue";
import EventStatusBadge from "../components/EventStatusBadge.vue";
import { scheduleHint } from "../event-schedule";
import { listAllEvents, type EventDto } from "../events.api";

type StatusFilter = "all" | EventDto["status"];

const router = useRouter();
const session = useSession();
const events = useAsyncData(listAllEvents, [] as EventDto[]);
const createOpen = ref(false);
const search = ref("");
const status = ref<StatusFilter>("all");

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
  { title: "Start", key: "startsAt" },
  { title: "End", key: "endsAt" },
  { title: "Time zone", key: "timeZone" },
  { title: "Updated", key: "updatedAt" },
];

/** Status sorts by lifecycle (active, draft, archived) and dates by time; missing dates last. */
const STATUS_ORDER: Record<EventDto["status"], number> = { active: 0, draft: 1, archived: 2 };
const byDate = (a: string | null, b: string | null): number =>
  (a === null ? Number.POSITIVE_INFINITY : Date.parse(a)) - (b === null ? Number.POSITIVE_INFINITY : Date.parse(b)) || 0;
const sortKeys = {
  status: (a: EventDto["status"], b: EventDto["status"]) => STATUS_ORDER[a] - STATUS_ORDER[b],
  startsAt: byDate,
  endsAt: byDate,
  updatedAt: byDate,
};
const sortBy = ref([{ key: "status", order: "asc" as const }]);

const rows = computed(() => {
  const text = (search.value ?? "").trim().toLowerCase();
  return events.data.value.filter(
    (event) =>
      (status.value === "all" || event.status === status.value) &&
      (text === "" || event.name.toLowerCase().includes(text) || event.slug.includes(text)),
  );
});

/** Dates in the event's own time zone, so organizers everywhere see the same days. */
function eventDate(event: EventDto, value: string | null): string {
  return value === null ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: event.timeZone }).format(new Date(value));
}

const updatedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

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
              <div class="text-caption text-medium-emphasis">{{ item.slug }}</div>
            </router-link>
          </template>
          <template #[`item.status`]="{ item }">
            <EventStatusBadge :status="item.status" />
          </template>
          <template #[`item.startsAt`]="{ item }">
            <div>{{ eventDate(item, item.startsAt) }}</div>
            <div v-if="item.status !== 'archived' && scheduleHint(item)" class="text-caption text-medium-emphasis">
              {{ scheduleHint(item) }}
            </div>
          </template>
          <template #[`item.endsAt`]="{ item }">{{ eventDate(item, item.endsAt) }}</template>
          <template #[`item.timeZone`]="{ item }">
            <span class="text-medium-emphasis">{{ item.timeZone }}</span>
          </template>
          <template #[`item.updatedAt`]="{ item }">
            <span class="text-medium-emphasis">{{ updatedFormat.format(new Date(item.updatedAt)) }}</span>
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
