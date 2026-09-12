<script setup lang="ts">
import { mdiCalendarPlus } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSession } from "@/modules/auth/session";
import CreateEventDialog from "../components/CreateEventDialog.vue";
import EventStatusBadge from "../components/EventStatusBadge.vue";
import { listAllEvents, type EventDto } from "../events.api";

const router = useRouter();
const session = useSession();
const events = useAsyncData(listAllEvents, [] as EventDto[]);
const createOpen = ref(false);

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
    <v-alert v-else-if="events.state.value === 'error'" type="error">{{ events.error.value }}</v-alert>
    <EmptyState v-else-if="events.data.value.length === 0" title="No events yet" text="Create a draft event to get started." />

    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th class="d-none d-sm-table-cell">Time zone</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="event in events.data.value"
            :key="event.id"
            class="cursor-pointer"
            tabindex="0"
            @click="open(event)"
            @keydown.enter="open(event)"
          >
            <td>
              <div class="font-weight-medium">{{ event.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ event.slug }}</div>
            </td>
            <td><EventStatusBadge :status="event.status" /></td>
            <td class="d-none d-sm-table-cell">{{ event.timeZone }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <CreateEventDialog v-model="createOpen" @created="open" />
  </ViewContent>
</template>
