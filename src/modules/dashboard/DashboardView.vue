<script setup lang="ts">
import { mdiCalendarBlank } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import type { Schemas } from "@/shared/api/types";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import ProfileSummary from "@/shared/components/ProfileSummary.vue";
import ProvisioningActions from "./components/ProvisioningActions.vue";
import { fetchMyMemberships, fetchProfile } from "./dashboard.api";

const session = useSession();
const memberships = ref<Schemas["MyEventMembershipDto"][]>([]);
const selectedEventId = ref<string | null>(null);
const profile = ref<Schemas["ResolvedProfileDto"] | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");

const selected = computed(
  () => memberships.value.find(({ eventId }) => eventId === selectedEventId.value) ?? null,
);
const canAdministerEvents = computed(() => session.can("events.read"));

async function loadProfile(): Promise<void> {
  profile.value =
    selected.value === null ? null : await fetchProfile(selected.value.eventId, selected.value.memberId);
}

/** Core returns only active events, so drafts and archived events never appear here. */
async function load(): Promise<void> {
  state.value = "loading";
  try {
    memberships.value = await fetchMyMemberships();
    selectedEventId.value = memberships.value[0]?.eventId ?? null;
    await loadProfile();
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

async function selectEvent(eventId: string): Promise<void> {
  selectedEventId.value = eventId;
  state.value = "loading";
  try {
    await loadProfile();
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

onMounted(load);
</script>

<template>
  <v-container fluid class="pt-3 pb-6 px-6">
    <ViewHeader
      :title="`Hello, ${session.state.principal?.name ?? ''}`"
      :subtitle="selected ? selected.eventName : 'Your OpenMeshTak overview'"
    >
      <template #actions>
        <v-select
          v-if="memberships.length > 1"
          :model-value="selectedEventId"
          :items="memberships"
          item-title="eventName"
          item-value="eventId"
          label="Event"
          density="compact"
          hide-details
          style="min-width: 220px"
          @update:model-value="selectEvent"
        />
      </template>
    </ViewHeader>

    <v-row v-if="state === 'loading'">
      <v-col cols="12" md="7"><v-skeleton-loader type="article" /></v-col>
      <v-col cols="12" md="5"><v-skeleton-loader type="card" /></v-col>
    </v-row>

    <ErrorState v-else-if="state === 'error'" :message="error" @retry="load" />

    <EmptyState
      v-else-if="selected === null || profile === null"
      :icon="mdiCalendarBlank"
      title="No active event"
      text="You are not part of an active event yet. Your profile appears here once your organizers add you."
    >
      <v-btn v-if="canAdministerEvents" color="primary" to="/admin/events">Manage events</v-btn>
    </EmptyState>

    <v-row v-else>
      <v-col cols="12" md="7">
        <ProfileSummary :event-name="selected.eventName" :profile="profile" />
      </v-col>
      <v-col cols="12" md="5" class="d-flex flex-column ga-4">
        <ProvisioningActions />
        <v-card class="pa-5">
          <div class="text-subtitle-1 font-weight-medium mb-1">Downloads</div>
          <p class="text-body-2 text-medium-emphasis mb-0">No data packages are published yet.</p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
