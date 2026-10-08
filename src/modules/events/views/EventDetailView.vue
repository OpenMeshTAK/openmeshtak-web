<script setup lang="ts">
import { mdiAccessPointNetwork } from "@mdi/js";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
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
import { listOpenSyncIssues } from "@/modules/members/members.api";
import DataPackagesPanel from "@/modules/data-packages/DataPackagesPanel.vue";
import MeshtasticPanel from "@/modules/meshtastic-configuration/MeshtasticPanel.vue";
import EventOverviewPanel from "../components/EventOverviewPanel.vue";
import EventAccountsCard from "../components/EventAccountsCard.vue";
import EventOptionsCard from "../components/EventOptionsCard.vue";
import EventSettingsForm from "../components/EventSettingsForm.vue";
import EventStatusBadge from "../components/EventStatusBadge.vue";
import { emptySettings, settingsFromEvent, settingsToRequest } from "../event-settings";
import { getEvent, updateEvent, type EventDto } from "../events.api";

const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();
const eventId = computed(() => String(route.params.eventId));

const event = ref<EventDto | null>(null);
const settings = ref(emptySettings());
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const TABS = ["overview", "settings", "roles", "groups", "members", "meshtastic", "sync-issues", "data-packages"];

/** The open tab lives in the URL, so reloads, links and the back button keep it. */
const tab = computed({
  get: () => {
    const requested = String(route.params.tab ?? "");
    const hidden = requested === "meshtastic" && event.value?.meshtasticEnabled === false;
    return TABS.includes(requested) && !hidden ? requested : "overview";
  },
  set: (next: string) => {
    void router.replace({ name: "event-detail", params: { eventId: eventId.value, tab: next === "overview" ? undefined : next } });
  },
});

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

/** Shown as a badge on the Sync issues tab; a failed count only hides the badge. */
const openSyncIssues = ref(0);

async function loadSyncIssueCount(): Promise<void> {
  try {
    openSyncIssues.value = (await listOpenSyncIssues(eventId.value)).length;
  } catch {
    openSyncIssues.value = 0;
  }
}

async function load(): Promise<void> {
  state.value = "loading";
  conflict.value = false;
  void loadSyncIssueCount();
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

/** The option switches save on their own; unsaved edits in the settings form stay untouched. */
function onOptionSaved(updated: EventDto): void {
  event.value = updated;
  settings.value.permanentAccounts = updated.permanentAccounts;
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
        <template #actions>
          <v-btn
            v-if="event.status === 'active' && session.can('tak-traffic.view', event.id)"
            :to="{ name: 'event-live', params: { eventId: event.id } }"
            variant="tonal"
            size="small"
            :prepend-icon="mdiAccessPointNetwork"
          >
            Live TAK
          </v-btn>
          <EventStatusBadge :status="event.status" />
        </template>
      </ViewHeader>

      <v-tabs v-model="tab" class="mb-4" density="compact" show-arrows>
        <v-tab value="overview">Overview</v-tab>
        <v-tab value="settings">Settings</v-tab>
        <v-tab value="roles">Roles</v-tab>
        <v-tab value="groups">Groups</v-tab>
        <v-tab value="members">Members</v-tab>
        <v-tab v-if="event.meshtasticEnabled" value="meshtastic">Meshtastic</v-tab>
        <v-tab value="sync-issues">
          Sync issues
          <v-badge v-if="openSyncIssues > 0" :content="openSyncIssues" color="error" inline />
        </v-tab>
        <v-tab v-if="session.can('data-packages.read', event.id)" value="data-packages">Data packages</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="overview">
          <EventOverviewPanel :key="event.id" :event="event" @changed="show" @open="tab = $event" />
        </v-window-item>
        <v-window-item value="settings">
          <v-row>
            <v-col cols="12" lg="8">
              <v-card class="pa-5 h-100">
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
            <v-col cols="12" lg="4">
              <EventOptionsCard :event="event" :editable="editable" class="h-100" @updated="onOptionSaved" />
            </v-col>
            <v-col v-if="session.can('users.read')" cols="12">
              <EventAccountsCard :event="event" />
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
        <v-window-item v-if="event.meshtasticEnabled" value="meshtastic">
          <MeshtasticPanel :event-id="event.id" :editable="editable" :active="event.status === 'active'" />
        </v-window-item>
        <v-window-item value="sync-issues">
          <SyncIssuesPanel :event="event" @loaded="openSyncIssues = $event" />
        </v-window-item>
        <v-window-item value="data-packages">
          <DataPackagesPanel :event="event" />
        </v-window-item>
      </v-window>
    </template>
  </v-container>
</template>
