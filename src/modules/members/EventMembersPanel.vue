<script setup lang="ts">
import { mdiAccountGroup, mdiAccountMultiple, mdiAccountPlus, mdiClose, mdiMagnify } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ProfileSummary from "@/shared/components/ProfileSummary.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { listGroups } from "@/modules/event-groups/event-groups.api";
import { listRoles } from "@/modules/event-roles/event-roles.api";
import ClaimLinkDialog from "@/modules/member-claims/ClaimLinkDialog.vue";
import DataPackageDownloads from "@/modules/dashboard/components/DataPackageDownloads.vue";
import MeshtasticProfileCard from "@/modules/dashboard/components/MeshtasticProfileCard.vue";
import AddMemberDialog from "./AddMemberDialog.vue";
import EditMemberDialog from "./EditMemberDialog.vue";
import GroupMemberList from "./GroupMemberList.vue";
import {
  fetchProfile,
  listMembers,
  removeMember,
  reorderGroupMembers,
  updateMember,
  type EventMemberDto,
} from "./members.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const emit = defineEmits<{ issuesChanged: [] }>();
const session = useSession();
const toast = useToast();

const members = ref<EventMemberDto[]>([]);
const roles = ref<{ id: string; slug: string; name: string }[]>([]);
const groups = ref<{ id: string; slug: string; name: string }[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const addOpen = ref(false);
const claimFor = ref<EventMemberDto | null>(null);
const editing = ref<EventMemberDto | null>(null);
const editOpen = ref(false);
const removing = ref<EventMemberDto | null>(null);
const profileFor = ref<EventMemberDto | null>(null);
const profile = ref<Schemas["ResolvedProfileDto"] | null>(null);
const profileError = ref<string | null>(null);

const mutable = computed(() => props.event.status !== "archived");
const canSync = computed(() => mutable.value && session.can("members.sync", props.event.id));
const canAdd = computed(() => canSync.value || (mutable.value && session.can("members.manage", props.event.id) && session.can("users.read")));
const memberUserIds = computed(() => members.value.map(({ userId }) => userId));
const canManage = computed(() => mutable.value && session.can("members.manage", props.event.id));
/** On-behalf provisioning: the operator downloads the member's own artifacts, audited by Core. */
const canProvision = computed(
  () => props.event.status === "active" && session.can("member-artifacts.download", props.event.id),
);
/** "all" or an event group ID; groups list their members in short-name order. */
const selected = ref("all");
const filter = ref("");
const renumbered = ref(false);

const selectedGroup = computed(() => groups.value.find(({ id }) => id === selected.value) ?? null);
const groupMembers = computed(() => members.value.filter(({ eventGroup }) => eventGroup.id === selected.value));
const filteredMembers = computed(() => {
  const text = filter.value.trim().toLowerCase();
  return text === ""
    ? members.value
    : members.value.filter((member) =>
        [member.callsign, member.displayName, member.shortName ?? "", member.eventRole.name, member.eventGroup.name].some((value) =>
          value.toLowerCase().includes(text),
        ),
      );
});

function countIn(groupId: string): number {
  return members.value.filter(({ eventGroup }) => eventGroup.id === groupId).length;
}

/** Core assigns the numbers; the list then shows what Core stored. */
/** A dragged order waits here until the administrator chose how to tell the affected members. */
const pendingOrder = ref<string[] | null>(null);

function reorder(memberIds: string[]): void {
  pendingOrder.value = memberIds;
}

async function cancelReorder(): Promise<void> {
  pendingOrder.value = null;
  // The list already shows the dragged order; reloading puts the stored order back.
  await load();
}

async function confirmReorder(notifyMembers: boolean): Promise<void> {
  const group = selectedGroup.value;
  const memberIds = pendingOrder.value;
  pendingOrder.value = null;
  if (group === null || memberIds === null) {
    return;
  }
  try {
    const ordered = await reorderGroupMembers(props.event.id, group.id, memberIds, notifyMembers);
    if (notifyMembers) {
      toast.success("Short names changed. Members with a confirmed email address are being notified.");
    }
    members.value = [...members.value.filter(({ eventGroup }) => eventGroup.id !== group.id), ...ordered];
    renumbered.value = true;
  } catch (caught: unknown) {
    toast.error(caught);
    await load();
  }
}

async function moveMember(member: EventMemberDto, groupId: string): Promise<void> {
  try {
    await updateMember(props.event.id, member.id, {
      version: member.version,
      eventRoleId: member.eventRole.id,
      eventGroupId: groupId,
      callsignOverride: member.callsignOverride,
    });
    toast.success(`${member.callsign} moved to ${groups.value.find(({ id }) => id === groupId)?.name ?? "the group"}.`);
    renumbered.value = true;
    await load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

const canClaim = computed(
  () => props.event.status === "active" && session.can("member-claims.create", props.event.id),
);

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedMembers, loadedRoles, loadedGroups] = await Promise.all([
      listMembers(props.event.id),
      listRoles(props.event.id),
      listGroups(props.event.id),
    ]);
    members.value = loadedMembers;
    roles.value = loadedRoles;
    groups.value = loadedGroups;
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

async function onAdded(outcome: "member" | "sync-issue"): Promise<void> {
  if (outcome === "member") {
    toast.success("Member saved.");
  } else {
    toast.warning("The member could not be resolved and was recorded as a sync issue.");
  }
  emit("issuesChanged");
  await load();
}

function edit(member: EventMemberDto): void {
  editing.value = member;
  editOpen.value = true;
}

async function onEdited(member: EventMemberDto): Promise<void> {
  toast.success(`${member.callsign} was updated.`);
  await load();
}

async function showProfile(member: EventMemberDto): Promise<void> {
  profileFor.value = member;
  profile.value = null;
  profileError.value = null;
  try {
    profile.value = await fetchProfile(props.event.id, member.id);
  } catch (caught: unknown) {
    profileError.value = describeError(caught);
  }
}

async function confirmRemove(): Promise<void> {
  const member = removing.value;
  removing.value = null;
  if (member === null) {
    return;
  }
  try {
    await removeMember(props.event.id, member.id);
    toast.success(`${member.callsign} was removed from this event.`);
    await load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4 ga-4 flex-wrap">
      <p class="text-body-2 text-medium-emphasis flex-grow-1 mb-0">
        Each member has exactly one role and one group. Integrations add members automatically;
        you can also add them here.
      </p>
      <v-btn
        v-if="canAdd"
        color="primary"
        :prepend-icon="mdiAccountPlus"
        :disabled="roles.length === 0 || groups.length === 0"
        @click="addOpen = true"
      >
        Add member
      </v-btn>
    </div>

    <v-alert v-if="event.status === 'draft' && canClaim === false && members.length > 0" type="info" class="mb-4">
      Access links can be created once the event is active.
    </v-alert>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="members.length === 0" title="No members yet" text="Members appear here once an integration or an administrator adds them." />

    <div v-else class="members-layout">
      <v-card class="members-menu pa-2" tag="nav" aria-label="Event groups">
        <v-list density="comfortable" nav mandatory :selected="[selected]" @update:selected="selected = String($event[0] ?? selected)">
          <v-list-item value="all" :prepend-icon="mdiAccountMultiple" title="All members">
            <template #append><span class="text-caption text-medium-emphasis">{{ members.length }}</span></template>
          </v-list-item>
          <v-list-subheader>Groups</v-list-subheader>
          <v-list-item v-for="group in groups" :key="group.id" :value="group.id" :prepend-icon="mdiAccountGroup" :title="group.name">
            <template #append><span class="text-caption text-medium-emphasis">{{ countIn(group.id) }}</span></template>
          </v-list-item>
        </v-list>
      </v-card>

      <div class="members-content">
        <v-alert v-if="renumbered" type="warning" variant="tonal" density="compact" closable class="mb-3" @click:close="renumbered = false">
          Short names changed. Radios that are already set up keep their old short name until the member is provisioned again.
        </v-alert>

        <template v-if="selectedGroup">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Drag members or use their menu to change the order. Core numbers them from 1 in this order.
          </p>
          <GroupMemberList
            :members="groupMembers"
            :groups="groups"
            :group-id="selectedGroup.id"
            :can-manage="canManage"
            @reorder="reorder"
            @move="moveMember"
          >
            <template #actions="{ member }">
              <span class="text-no-wrap"><v-btn variant="text" size="small" @click="showProfile(member)">Profile</v-btn> <v-btn v-if="canClaim" variant="text" size="small" @click="claimFor = member">Access link</v-btn> <v-btn v-if="canManage" variant="text" size="small" @click="edit(member)">Edit</v-btn> <v-btn v-if="canManage" variant="text" size="small" color="error" @click="removing = member">Remove</v-btn></span>
            </template>
          </GroupMemberList>
        </template>

        <template v-else>
          <v-text-field
            v-model="filter"
            :prepend-inner-icon="mdiMagnify"
            label="Filter by name, callsign, short name, role or group"
            density="compact"
            clearable
            hide-details
            class="mb-3"
          />
          <v-card>
            <v-table>
              <thead>
                <tr>
                  <th>Callsign</th>
                  <th>Short name</th>
                  <th class="d-none d-md-table-cell">Role</th>
                  <th>Group</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in filteredMembers" :key="member.id">
                  <td>
                    <div class="font-weight-medium">{{ member.callsign }}</div>
                    <div v-if="member.callsignOverride" class="text-caption text-medium-emphasis">Callsign override</div>
                  </td>
                  <td>{{ member.shortName ?? "—" }}</td>
                  <td class="d-none d-md-table-cell">{{ member.eventRole.name }}</td>
                  <td>{{ member.eventGroup.name }}</td>
                  <td class="text-right text-no-wrap">
                    <v-btn variant="text" size="small" @click="showProfile(member)">Profile</v-btn>
                    <v-btn v-if="canClaim" variant="text" size="small" @click="claimFor = member">Access link</v-btn>
                    <v-btn v-if="canManage" variant="text" size="small" @click="edit(member)">Edit</v-btn>
                    <v-btn v-if="canManage" variant="text" size="small" color="error" @click="removing = member">Remove</v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </template>
      </div>
    </div>

    <AddMemberDialog
      v-model="addOpen"
      :event-id="event.id"
      :roles="roles"
      :groups="groups"
      :member-user-ids="memberUserIds"
      @saved="onAdded"
    />

    <EditMemberDialog
      v-model="editOpen"
      :event-id="event.id"
      :member="editing"
      :roles="roles"
      :groups="groups"
      @saved="onEdited"
    />

    <ClaimLinkDialog
      v-if="claimFor"
      :model-value="claimFor !== null"
      :event-id="event.id"
      :member-id="claimFor.id"
      :callsign="claimFor.callsign"
      @update:model-value="claimFor = null"
    />

    <v-dialog
      :model-value="profileFor !== null"
      :max-width="canProvision ? 960 : 560"
      @update:model-value="profileFor = null"
    >
      <v-alert v-if="profileError" type="error">{{ profileError }}</v-alert>
      <v-skeleton-loader v-else-if="profile === null" type="article" />
      <div v-else>
        <v-alert v-if="profile.source === 'preview'" type="info" class="mb-2">
          Preview of the unpublished draft configuration. Participants cannot see draft events.
        </v-alert>
        <v-card v-if="canProvision && profile.source === 'published'" class="provision-sheet">
          <div class="d-flex align-center pa-4 pb-0">
            <div class="flex-grow-1">
              <div class="text-h6">Set up devices for {{ profile.callsign }}</div>
              <div class="text-body-2 text-medium-emphasis">
                You download exactly what this member receives. Every view and download is audited.
              </div>
            </div>
            <v-btn :icon="mdiClose" variant="text" aria-label="Close" @click="profileFor = null" />
          </div>
          <v-card-text class="provision-body">
            <v-row dense>
              <v-col cols="12" md="6">
                <ProfileSummary :event-name="event.name" :profile="profile" />
              </v-col>
              <v-col cols="12" md="6" class="d-flex flex-column ga-2">
                <MeshtasticProfileCard :profile="profile" on-behalf />
                <DataPackageDownloads :event-id="profile.eventId" :member-id="profile.memberId" />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
        <ProfileSummary v-else :event-name="event.name" :profile="profile" />
      </div>
    </v-dialog>

    <v-dialog :model-value="pendingOrder !== null" max-width="520" persistent>
      <v-card class="pa-2">
        <v-card-title>Change short names?</v-card-title>
        <v-card-text>
          The new order renumbers this group. Radios that are already set up keep their old short
          name until the member downloads and imports their settings file again.
        </v-card-text>
        <v-card-actions class="flex-wrap ga-2">
          <v-btn variant="text" @click="cancelReorder">Cancel</v-btn>
          <v-spacer />
          <v-btn variant="tonal" @click="confirmReorder(false)">Only show a warning</v-btn>
          <v-btn color="primary" variant="flat" @click="confirmReorder(true)">Email affected members</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      :model-value="removing !== null"
      title="Remove this member?"
      confirm-label="Remove"
      confirm-color="error"
      @update:model-value="removing = null"
      @confirm="confirmRemove"
    >
      {{ removing?.callsign }} loses access to this event. Their account and memberships in other
      events stay. Their integration may add them again on its next synchronization.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.provision-sheet {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
}

.provision-body {
  overflow-y: auto;
}

.provision-body :deep(.v-card) {
  background: rgb(var(--v-theme-surface-light));
  box-shadow: none;
}

.provision-body :deep(.v-list) {
  background: transparent;
}

.members-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.members-menu {
  position: sticky;
  top: 16px;
}

@media (max-width: 959px) {
  .members-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .members-menu {
    position: static;
  }
}
</style>
