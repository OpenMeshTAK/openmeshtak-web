<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import EventGroupsPanel from "@/modules/event-groups/EventGroupsPanel.vue";
import EventRolesPanel from "@/modules/event-roles/EventRolesPanel.vue";
import EventMembersPanel from "@/modules/members/EventMembersPanel.vue";
import SyncIssuesPanel from "@/modules/members/SyncIssuesPanel.vue";
import MissionsPanel from "@/modules/missions/MissionsPanel.vue";
import EventLifecycleCard from "../components/EventLifecycleCard.vue";
import EventSettingsForm from "../components/EventSettingsForm.vue";
import EventStatusBadge from "../components/EventStatusBadge.vue";
import { emptySettings, settingsFromEvent, settingsToRequest } from "../event-settings";
import { getEvent, updateEvent, type EventDto } from "../events.api";

const route = useRoute();
const session = useSession();
const toast = useToast();
const eventId = computed(() => String(route.params.eventId));

const event = ref<EventDto | null>(null);
const settings = ref(emptySettings());
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const tab = ref("overview");

const saving = ref(false);
const conflict = ref(false);
const saveFields = ref<Record<string, string>>({});

const editable = computed(
  () =>
    event.value !== null &&
    event.value.status !== "archived" &&
    session.can("events.manage", event.value.id),
);

function show(loaded: EventDto): void {
  event.value = loaded;
  settings.value = settingsFromEvent(loaded);
}

async function load(): Promise<void> {
  state.value = "loading";
  conflict.value = false;
  try {
    show(await getEvent(eventId.value));
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value =
      isApiProblem(caught) && caught.status === 404 ? "This event does not exist." : describeError(caught);
    state.value = "error";
  }
}

async function save(): Promise<void> {
  if (event.value === null) {
    return;
  }
  saving.value = true;
  conflict.value = false;
  saveFields.value = {};
  try {
    show(
      await updateEvent(event.value.id, {
        version: event.value.version,
        ...settingsToRequest(settings.value),
      }),
    );
    toast.success("Event settings saved.");
  } catch (caught: unknown) {
    saveFields.value = fieldErrors(caught);
    conflict.value = isApiProblem(caught, "VERSION_CONFLICT");
    // A conflict stays visible next to the form with a reload action; other failures are toasts.
    if (!conflict.value) {
      toast.error(caught);
    }
  } finally {
    saving.value = false;
  }
}

watch(eventId, load);
onMounted(load);
</script>

<template>
  <v-container fluid class="pt-3 pb-6 px-6">
    <v-skeleton-loader v-if="state === 'loading'" type="heading, article" />
    <ErrorState v-else-if="state === 'error' || event === null" :message="loadError" @retry="load" />

    <template v-else>
      <ViewHeader :title="event.name" :subtitle="`${event.slug} · ${event.timeZone}`">
        <template #actions><EventStatusBadge :status="event.status" /></template>
      </ViewHeader>

      <v-tabs v-model="tab" class="mb-6" show-arrows>
        <v-tab value="overview">Overview</v-tab>
        <v-tab value="roles">Roles</v-tab>
        <v-tab value="groups">Groups</v-tab>
        <v-tab value="members">Members</v-tab>
        <v-tab value="sync-issues">Sync issues</v-tab>
        <v-tab v-if="session.can('missions.read', event.id)" value="missions">Missions</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="overview">
          <v-row>
            <v-col cols="12" md="7">
              <v-card class="pa-5">
                <div class="text-subtitle-1 font-weight-medium mb-4">Settings</div>
                <v-alert v-if="conflict" type="warning" class="mb-4">
                  Someone else changed this event. Reload to see their changes before saving again.
                  <v-btn size="small" variant="outlined" class="ml-2" @click="load">Reload</v-btn>
                </v-alert>
                <EventSettingsForm v-model="settings" :errors="saveFields" :disabled="!editable" />
                <v-btn v-if="editable" color="primary" class="mt-2" :loading="saving" @click="save">
                  Save changes
                </v-btn>
              </v-card>
            </v-col>
            <v-col cols="12" md="5">
              <EventLifecycleCard :event="event" @changed="show" />
            </v-col>
          </v-row>
        </v-window-item>
        <v-window-item value="roles">
          <EventRolesPanel :event-id="event.id" :editable="editable" />
        </v-window-item>
        <v-window-item value="groups">
          <EventGroupsPanel :event-id="event.id" :editable="editable" />
        </v-window-item>
        <v-window-item value="members">
          <EventMembersPanel :event="event" />
        </v-window-item>
        <v-window-item value="sync-issues">
          <SyncIssuesPanel :event="event" />
        </v-window-item>
        <v-window-item value="missions">
          <MissionsPanel :event="event" />
        </v-window-item>
      </v-window>
    </template>
  </v-container>
</template>
