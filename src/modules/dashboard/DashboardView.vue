<script setup lang="ts">
import { mdiCalendarBlank } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import type { Schemas } from "@/shared/api/types";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import ProfileSummary from "@/shared/components/ProfileSummary.vue";
import ChannelHandoutsCard from "./components/ChannelHandoutsCard.vue";
import DataPackagesStep from "./components/DataPackagesStep.vue";
import TakEnrollmentCard from "@/modules/tak-server/components/TakEnrollmentCard.vue";
import TakSetupGuide from "./components/TakSetupGuide.vue";
import MeshtasticProfileCard from "./components/MeshtasticProfileCard.vue";
import ProvisioningActions from "./components/ProvisioningActions.vue";
import SetupStep from "./components/SetupStep.vue";
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
const isTakAdministrator = computed(() => session.can("tak-server.admin-access"));
const takMode = computed(() => profile.value?.tak.connection?.mode ?? null);
const isKeyHolder = computed(() => profile.value?.meshtastic.channels.some(({ keyHolder }) => keyHolder) ?? false);
/** TAK administrators may connect even when the event itself does not use the built-in server. */
const showAdminTakCard = computed(() => isTakAdministrator.value && takMode.value !== "built-in-server");
const hasAside = computed(() => isKeyHolder.value || showAdminTakCard.value);

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
  <ViewContent>
    <ViewHeader
      :title="`Hello, ${session.state.principal?.name ?? ''}`"
      :subtitle="selected ? 'Your setup for this event' : 'Your OpenMeshTak overview'"
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
          class="event-switcher"
          @update:model-value="selectEvent"
        />
      </template>
    </ViewHeader>

    <template v-if="state === 'loading'">
      <v-skeleton-loader type="article" class="mb-6" />
      <v-row>
        <v-col cols="12" lg="8"><v-skeleton-loader type="card, card" /></v-col>
        <v-col cols="12" lg="4"><v-skeleton-loader type="card" /></v-col>
      </v-row>
    </template>

    <ErrorState v-else-if="state === 'error'" :message="error" @retry="load" />

    <template v-else-if="selected === null || profile === null">
      <EmptyState
        :icon="mdiCalendarBlank"
        title="No active event"
        text="You are not part of an active event yet. Your profile appears here once your organizers add you."
      >
        <v-btn v-if="canAdministerEvents" color="primary" to="/admin/events">Manage events</v-btn>
      </EmptyState>

      <!-- TAK administrators may connect without being a member of an event. -->
      <v-row v-if="isTakAdministrator" justify="center">
        <v-col cols="12" md="6"><TakEnrollmentCard /></v-col>
      </v-row>
    </template>

    <template v-else>
      <ProfileSummary :event-name="selected.eventName" :profile="profile" class="mb-4" />

      <div class="dashboard-grid" :class="{ 'dashboard-grid--aside': hasAside }">
        <section aria-label="Set up your devices">
          <ol class="setup-steps">
            <SetupStep :number="1">
              <MeshtasticProfileCard :profile="profile" />
            </SetupStep>
            <SetupStep :number="2">
              <TakSetupGuide v-if="takMode === 'meshtastic-local-server'" :profile="profile" />
              <TakEnrollmentCard v-else-if="takMode === 'built-in-server'" />
              <ProvisioningActions v-else />
            </SetupStep>
            <SetupStep :number="3" last>
              <DataPackagesStep
                :event-id="profile.eventId"
                :member-id="profile.memberId"
                :enrolled-in-setup="takMode === 'built-in-server'"
              />
            </SetupStep>
          </ol>
        </section>

        <aside v-if="hasAside" class="dashboard-aside">
          <ChannelHandoutsCard
            v-if="isKeyHolder"
            :event-id="profile.eventId"
            :member-id="profile.memberId"
            :channels="profile.meshtastic.channels"
          />
          <TakEnrollmentCard v-if="showAdminTakCard" />
        </aside>
      </div>
    </template>
  </ViewContent>
</template>

<style scoped>
.event-switcher {
  width: min(260px, 100%);
}

/* One 16px gap between every box: columns, side cards and setup steps. */
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (min-width: 1280px) {
  .dashboard-grid--aside {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
}

.setup-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.dashboard-aside {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Keep key-holder handouts in view next to the long setup flow on wide screens. */
@media (min-width: 1280px) {
  .dashboard-aside {
    position: sticky;
    top: 16px;
  }
}
</style>
