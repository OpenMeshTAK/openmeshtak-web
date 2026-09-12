<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import { listAllEvents } from "@/modules/events/events.api";
import {
  addGroupMember,
  deleteUserGroup,
  getUserGroup,
  listAllUsers,
  listGroupMembers,
  removeGroupMember,
  updateUserGroup,
  type UserDto,
  type UserGroupDto,
} from "./user-groups.api";

const route = useRoute();
const router = useRouter();
const session = useSession();
const userGroupId = computed(() => String(route.params.userGroupId));

const group = ref<UserGroupDto | null>(null);
const members = ref<UserDto[]>([]);
const users = ref<UserDto[]>([]);
const events = ref<{ id: string; name: string }[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const name = ref("");
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const saving = ref(false);
const notice = ref<{ type: "success" | "error"; text: string } | null>(null);
const userToAdd = ref<string | null>(null);
const confirmDelete = ref(false);

const canManage = computed(() => session.can("user-groups.manage"));
const candidates = computed(() =>
  users.value.filter(({ id }) => !members.value.some((member) => member.id === id)),
);

function show(loaded: UserGroupDto): void {
  group.value = loaded;
  name.value = loaded.name;
  grants.value = structuredClone(loaded.permissions);
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedGroup, loadedMembers, loadedEvents] = await Promise.all([
      getUserGroup(userGroupId.value),
      listGroupMembers(userGroupId.value),
      listAllEvents(),
    ]);
    show(loadedGroup);
    members.value = loadedMembers;
    events.value = loadedEvents.map(({ id, name: eventName }) => ({ id, name: eventName }));
    users.value = session.can("users.read") ? await listAllUsers() : [];
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function report(caught: unknown): void {
  notice.value = {
    type: "error",
    text: isApiProblem(caught, "SYSTEM_GROUP_PROTECTED")
      ? `${caught.message} The Admin group always keeps every permission and at least one member.`
      : describeError(caught),
  };
}

async function save(): Promise<void> {
  if (group.value === null) {
    return;
  }
  saving.value = true;
  notice.value = null;
  try {
    show(
      await updateUserGroup(group.value.id, {
        version: group.value.version,
        name: name.value,
        slug: group.value.slug,
        permissions: grants.value,
      }),
    );
    notice.value = { type: "success", text: "Saved. Members' access changed immediately." };
  } catch (caught: unknown) {
    report(caught);
  } finally {
    saving.value = false;
  }
}

async function addMember(): Promise<void> {
  if (userToAdd.value === null) {
    return;
  }
  notice.value = null;
  try {
    await addGroupMember(userGroupId.value, userToAdd.value);
    userToAdd.value = null;
    members.value = await listGroupMembers(userGroupId.value);
  } catch (caught: unknown) {
    report(caught);
  }
}

async function removeMember(user: UserDto): Promise<void> {
  notice.value = null;
  try {
    await removeGroupMember(userGroupId.value, user.id);
    members.value = await listGroupMembers(userGroupId.value);
  } catch (caught: unknown) {
    report(caught);
  }
}

async function remove(): Promise<void> {
  try {
    await deleteUserGroup(userGroupId.value);
    await router.push({ name: "user-groups" });
  } catch (caught: unknown) {
    confirmDelete.value = false;
    report(caught);
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-6">
    <v-skeleton-loader v-if="state === 'loading'" type="heading, article" />
    <ErrorState v-else-if="state === 'error' || group === null" :message="loadError" @retry="load" />

    <template v-else>
      <PageHeader :title="group.name" :subtitle="group.system ? 'Protected system group' : 'User group'">
        <template #actions>
          <v-btn v-if="canManage && !group.system" color="error" variant="outlined" @click="confirmDelete = true">
            Delete group…
          </v-btn>
        </template>
      </PageHeader>

      <v-alert v-if="notice" :type="notice.type" closable class="mb-4" @click:close="notice = null">
        {{ notice.text }}
      </v-alert>

      <v-row>
        <v-col cols="12" lg="7">
          <v-card class="pa-5">
            <div class="text-subtitle-1 font-weight-medium mb-4">Permissions</div>
            <v-alert v-if="group.system" type="info" class="mb-4">
              The Admin group always holds every permission instance-wide. Only its name can change.
            </v-alert>
            <v-text-field v-model="name" label="Name" :disabled="!canManage" />
            <PermissionGrantEditor v-model="grants" :events="events" :disabled="!canManage || group.system" />
            <v-btn v-if="canManage" color="primary" class="mt-4" :loading="saving" @click="save">Save changes</v-btn>
          </v-card>
        </v-col>

        <v-col cols="12" lg="5">
          <v-card class="pa-5">
            <div class="text-subtitle-1 font-weight-medium mb-4">Members</div>
            <v-list v-if="members.length > 0" density="compact" class="mb-4">
              <v-list-item v-for="member in members" :key="member.id" :title="member.displayName" :subtitle="member.email ?? 'No local login'">
                <template v-if="canManage" #append>
                  <v-btn variant="text" size="small" color="error" @click="removeMember(member)">Remove</v-btn>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-body-2 mb-4">No members yet.</p>

            <div v-if="canManage && users.length > 0" class="d-flex ga-2 align-center">
              <v-autocomplete
                v-model="userToAdd"
                :items="candidates"
                item-title="displayName"
                item-value="id"
                label="Add a user"
                variant="outlined"
                density="comfortable"
                hide-details
              />
              <v-btn color="primary" :disabled="userToAdd === null" @click="addMember">Add</v-btn>
            </div>
            <p class="text-caption text-medium-emphasis mt-2 mb-0">
              You can only add members to groups whose permissions you hold yourself.
            </p>
          </v-card>
        </v-col>
      </v-row>

      <ConfirmDialog v-model="confirmDelete" title="Delete this user group?" confirm-label="Delete" confirm-color="error" @confirm="remove">
        All members lose the permissions of {{ group.name }} immediately.
      </ConfirmDialog>
    </template>
  </v-container>
</template>
