<script setup lang="ts">
import { mdiAccountPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ProfileSummary from "@/shared/components/ProfileSummary.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import { listGroups } from "@/modules/event-groups/event-groups.api";
import { listRoles } from "@/modules/event-roles/event-roles.api";
import ClaimLinkDialog from "@/modules/member-claims/ClaimLinkDialog.vue";
import AddMemberDialog from "./AddMemberDialog.vue";
import EditMemberDialog from "./EditMemberDialog.vue";
import { fetchProfile, listMembers, removeMember, type EventMemberDto } from "./members.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const emit = defineEmits<{ issuesChanged: [] }>();
const session = useSession();

const members = ref<EventMemberDto[]>([]);
const roles = ref<{ id: string; slug: string; name: string }[]>([]);
const groups = ref<{ id: string; slug: string; name: string }[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const notice = ref<{ type: "success" | "warning" | "error"; text: string } | null>(null);

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
const canManage = computed(() => mutable.value && session.can("members.manage", props.event.id));
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
  notice.value =
    outcome === "member"
      ? { type: "success", text: "Member saved." }
      : { type: "warning", text: "The member could not be resolved and was recorded as a sync issue." };
  emit("issuesChanged");
  await load();
}

function edit(member: EventMemberDto): void {
  editing.value = member;
  editOpen.value = true;
}

async function onEdited(member: EventMemberDto): Promise<void> {
  notice.value = { type: "success", text: `${member.callsign} was updated.` };
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
  if (removing.value === null) {
    return;
  }
  try {
    await removeMember(props.event.id, removing.value.id);
    notice.value = { type: "success", text: `${removing.value.callsign} was removed from this event.` };
    removing.value = null;
    await load();
  } catch (caught: unknown) {
    notice.value = { type: "error", text: describeError(caught) };
    removing.value = null;
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
        v-if="canSync"
        color="primary"
        :prepend-icon="mdiAccountPlus"
        :disabled="roles.length === 0 || groups.length === 0"
        @click="addOpen = true"
      >
        Add member
      </v-btn>
    </div>

    <v-alert v-if="notice" :type="notice.type" closable class="mb-4" @click:close="notice = null">
      {{ notice.text }}
    </v-alert>
    <v-alert v-if="event.status === 'draft' && canClaim === false && members.length > 0" type="info" class="mb-4">
      Access links can be created once the event is active.
    </v-alert>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="members.length === 0" title="No members yet" text="Members appear here once an integration or an administrator adds them." />

    <v-card v-else>
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
          <tr v-for="member in members" :key="member.id">
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

    <AddMemberDialog v-model="addOpen" :event-id="event.id" :roles="roles" :groups="groups" @saved="onAdded" />

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

    <v-dialog :model-value="profileFor !== null" max-width="560" @update:model-value="profileFor = null">
      <v-alert v-if="profileError" type="error">{{ profileError }}</v-alert>
      <v-skeleton-loader v-else-if="profile === null" type="article" />
      <div v-else>
        <v-alert v-if="profile.source === 'preview'" type="info" class="mb-2">
          Preview of the unpublished draft configuration. Participants cannot see draft events.
        </v-alert>
        <ProfileSummary :event-name="event.name" :profile="profile" />
      </div>
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
