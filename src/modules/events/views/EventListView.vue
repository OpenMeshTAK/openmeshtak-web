<script setup lang="ts">
import { mdiCalendarPlus } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useSession } from "@/modules/auth/session";
import EventSettingsForm from "../components/EventSettingsForm.vue";
import EventStatusBadge from "../components/EventStatusBadge.vue";
import { emptySettings, settingsToRequest } from "../event-settings";
import { createEvent, listAllEvents, type EventDto } from "../events.api";

const router = useRouter();
const session = useSession();
const events = ref<EventDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");

const dialogOpen = ref(false);
const draft = ref(emptySettings());
const creating = ref(false);
const createError = ref<string | null>(null);
const createFields = ref<Record<string, string>>({});

async function load(): Promise<void> {
  state.value = "loading";
  try {
    events.value = await listAllEvents();
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

function openCreate(): void {
  draft.value = emptySettings();
  createError.value = null;
  createFields.value = {};
  dialogOpen.value = true;
}

async function create(): Promise<void> {
  creating.value = true;
  createError.value = null;
  try {
    const event = await createEvent(settingsToRequest(draft.value));
    dialogOpen.value = false;
    await router.push({ name: "event-detail", params: { eventId: event.id } });
  } catch (caught: unknown) {
    createFields.value = fieldErrors(caught);
    createError.value = describeError(caught);
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-6">
    <PageHeader title="Events" subtitle="Create events as drafts, configure them, then activate.">
      <template #actions>
        <v-btn v-if="session.can('events.manage')" color="primary" :prepend-icon="mdiCalendarPlus" @click="openCreate">
          New event
        </v-btn>
      </template>
    </PageHeader>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="error" @retry="load" />
    <EmptyState v-else-if="events.length === 0" title="No events yet" text="Create a draft event to get started." />

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
            v-for="event in events"
            :key="event.id"
            class="cursor-pointer"
            tabindex="0"
            @click="router.push({ name: 'event-detail', params: { eventId: event.id } })"
            @keydown.enter="router.push({ name: 'event-detail', params: { eventId: event.id } })"
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

    <v-dialog v-model="dialogOpen" max-width="560">
      <v-card class="pa-2">
        <v-card-title>New event</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            New events start as drafts and stay invisible to participants until you activate them.
          </p>
          <v-alert v-if="createError" type="error" class="mb-4">{{ createError }}</v-alert>
          <EventSettingsForm v-model="draft" :errors="createFields" auto-slug />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="creating" @click="create">Create draft</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
