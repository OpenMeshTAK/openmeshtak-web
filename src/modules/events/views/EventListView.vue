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
import EventCard from "../components/EventCard.vue";
import { compareEvents } from "../event-schedule";
import { listAllEvents, type EventDto } from "../events.api";

type StatusFilter = "all" | EventDto["status"];

const router = useRouter();
const session = useSession();
const events = useAsyncData(listAllEvents, [] as EventDto[]);
const createOpen = ref(false);
const status = ref<StatusFilter>("all");
const search = ref("");

const filters = computed(() => {
  const count = (value: StatusFilter): number =>
    value === "all" ? events.data.value.length : events.data.value.filter((event) => event.status === value).length;
  return (
    [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
    ] as const
  ).map((filter) => ({ ...filter, count: count(filter.value) }));
});

const visible = computed(() => {
  const text = search.value.trim().toLowerCase();
  return events.data.value
    .filter((event) => status.value === "all" || event.status === status.value)
    .filter((event) => text === "" || event.name.toLowerCase().includes(text) || event.slug.includes(text))
    .sort(compareEvents);
});

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

    <div v-if="events.state.value === 'loading'" class="event-grid">
      <v-skeleton-loader v-for="index in 3" :key="index" type="article" />
    </div>
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
      <div class="event-toolbar mb-4">
        <v-chip-group v-model="status" mandatory aria-label="Filter by status">
          <v-chip
            v-for="filter in filters"
            :key="filter.value"
            :value="filter.value"
            :variant="status === filter.value ? 'tonal' : 'text'"
            :color="status === filter.value ? 'primary' : undefined"
            label
          >
            {{ filter.label }} <span class="text-medium-emphasis ml-1">{{ filter.count }}</span>
          </v-chip>
        </v-chip-group>
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          label="Search events"
          density="compact"
          hide-details
          clearable
          class="event-toolbar__search"
        />
      </div>

      <div v-if="visible.length > 0" class="event-grid">
        <EventCard v-for="event in visible" :key="event.id" :event="event" />
      </div>
      <p v-else class="text-body-2 text-medium-emphasis">No events match this filter.</p>
    </template>

    <CreateEventDialog v-model="createOpen" @created="open" />
  </ViewContent>
</template>

<style scoped>
.event-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.event-toolbar__search {
  flex: 0 1 320px;
  min-width: 200px;
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

@media (max-width: 599px) {
  .event-toolbar__search {
    flex-basis: 100%;
  }

  .event-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
