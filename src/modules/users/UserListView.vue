<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiAccountOff, mdiAccountPlus, mdiDotsVertical, mdiMagnify } from "@mdi/js";
import { onMounted, ref, watch } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import CreateUserDialog from "./CreateUserDialog.vue";
import SetupLinkDialog from "./SetupLinkDialog.vue";
import { revokeUserSessions, searchUsers, sendPasswordReset, setUserDisabled, updateUser, type UserDto } from "./users.api";

/**
 * Installation-wide user administration. Administrators never see or set passwords: new users
 * get a setup link to choose their own. Administrators edit the name and username, disable or
 * sign users out. Event membership stays on each event's Members tab.
 */
const session = useSession();
const toast = useToast();

const users = ref<UserDto[]>([]);
const nextCursor = ref<string | null>(null);
const search = ref("");
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const canManage = session.can("users.manage");

const editing = ref<UserDto | null>(null);
const newName = ref("");
const newUsername = ref("");
const saving = ref(false);
const editError = ref("");
const confirmDisable = ref<UserDto | null>(null);
const confirmSignOut = ref<UserDto | null>(null);
const createOpen = ref(false);
const setupLinkFor = ref<UserDto | null>(null);

function onCreated(user: UserDto): void {
  users.value = [...users.value, user];
}

async function load(append = false): Promise<void> {
  if (!append) {
    state.value = "loading";
  }
  try {
    const page = await searchUsers(search.value, append ? nextCursor.value : null);
    users.value = append ? [...users.value, ...page.items] : page.items;
    nextCursor.value = page.page.nextCursor ?? null;
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(), 300);
});

function replace(updated: UserDto): void {
  users.value = users.value.map((user) => (user.id === updated.id ? updated : user));
}

function startEdit(user: UserDto): void {
  editing.value = user;
  newName.value = user.displayName;
  newUsername.value = user.username ?? "";
  editError.value = "";
}

/** Errors stay in the open dialog, so a taken username can be corrected without retyping. */
async function saveEdit(): Promise<void> {
  const user = editing.value;
  if (user === null || newName.value.trim() === "") {
    return;
  }
  const username = user.username === null ? null : normalizeUsernameInput(newUsername.value);
  if (username !== null && usernameRule(username) !== true) {
    return;
  }
  saving.value = true;
  editError.value = "";
  try {
    const updated = await updateUser(user, newName.value.trim(), username);
    replace(updated);
    editing.value = null;
    toast.success(`${updated.displayName} was updated.`);
  } catch (caught: unknown) {
    editError.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}

async function toggleDisabled(user: UserDto, disabled: boolean): Promise<void> {
  confirmDisable.value = null;
  try {
    replace(await setUserDisabled(user.id, disabled));
    toast.success(disabled ? `${user.displayName} was disabled and signed out.` : `${user.displayName} can sign in again.`);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function resetPassword(user: UserDto): Promise<void> {
  try {
    await sendPasswordReset(user.id);
    toast.success(`If ${user.displayName} has a confirmed email address, a reset link is on its way.`);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function signOut(user: UserDto): Promise<void> {
  confirmSignOut.value = null;
  try {
    await revokeUserSessions(user.id);
    toast.success(`${user.displayName} was signed out everywhere.`);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(() => void load());
</script>

<template>
  <ViewContent>
    <ViewHeader title="Users" subtitle="Everyone with an OpenMeshTak account. Permissions come from user groups.">
      <template #actions>
        <v-btn v-if="canManage" color="primary" :prepend-icon="mdiAccountPlus" @click="createOpen = true">Create user</v-btn>
      </template>
    </ViewHeader>

    <v-text-field
      v-model="search"
      :prepend-inner-icon="mdiMagnify"
      label="Search by name or email"
      density="compact"
      clearable
      hide-details
      class="mb-4"
      style="max-width: 420px"
    />

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="error" @retry="load()" />
    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th class="d-none d-md-table-cell">Email</th>
            <th>Status</th>
            <th v-if="canManage" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="font-weight-medium">{{ user.displayName }}</td>
            <td>
              <code v-if="user.username">{{ user.username }}</code>
              <span v-else class="text-medium-emphasis">—</span>
            </td>
            <td class="d-none d-md-table-cell text-medium-emphasis">{{ user.email ?? "No local sign-in yet" }}</td>
            <td>
              <v-chip v-if="user.disabled" size="small" color="error" variant="tonal" :prepend-icon="mdiAccountOff">Disabled</v-chip>
              <v-chip v-else-if="!user.passwordSet" size="small" color="warning" variant="tonal">Setup pending</v-chip>
              <v-chip v-else size="small" color="success" variant="tonal">Active</v-chip>
            </td>
            <td v-if="canManage" class="text-right">
              <v-menu>
                <template #activator="{ props: menu }">
                  <v-btn v-bind="menu" :icon="mdiDotsVertical" variant="text" size="small" :aria-label="`Actions for ${user.displayName}`" />
                </template>
                <v-list density="compact">
                  <v-list-item title="Edit" @click="startEdit(user)" />
                  <v-list-item v-if="!user.passwordSet" title="Create setup link" @click="setupLinkFor = user" />
                  <v-list-item title="Send password reset email" :disabled="user.email === null" @click="resetPassword(user)" />
                  <v-list-item title="Sign out everywhere" @click="confirmSignOut = user" />
                  <v-list-item v-if="user.disabled" title="Enable" @click="toggleDisabled(user, false)" />
                  <v-list-item v-else title="Disable" base-color="error" @click="confirmDisable = user" />
                </v-list>
              </v-menu>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="5" class="text-medium-emphasis">No users match the search.</td>
          </tr>
        </tbody>
      </v-table>
      <div v-if="nextCursor" class="d-flex justify-center pa-3">
        <v-btn variant="text" @click="load(true)">Load more</v-btn>
      </div>
    </v-card>

    <v-dialog :model-value="editing !== null" max-width="460" @update:model-value="editing = null">
      <v-card class="pa-2">
        <v-card-title>Edit user</v-card-title>
        <v-card-text>
          <v-alert v-if="editError" type="error" density="compact" class="mb-4">{{ editError }}</v-alert>
          <v-text-field v-model="newName" label="Display name" maxlength="100" autofocus @keydown.enter="saveEdit" />
          <v-text-field
            v-if="editing?.username !== null"
            v-model="newUsername"
            label="Username"
            autocapitalize="none"
            spellcheck="false"
            :rules="[(value: string) => usernameRule(normalizeUsernameInput(value))]"
            @keydown.enter="saveEdit"
          >
            <template #append-inner>
              <InfoHint label="About username" :text="USERNAME_HINT" />
            </template>
          </v-text-field>
          <p v-else class="text-body-medium text-medium-emphasis my-0">
            The username is created when this user first signs in.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editing = null">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CreateUserDialog v-model="createOpen" @created="onCreated" />
    <SetupLinkDialog
      v-if="setupLinkFor"
      :user="setupLinkFor"
      :model-value="setupLinkFor !== null"
      @update:model-value="setupLinkFor = null"
    />

    <ConfirmDialog
      :model-value="confirmDisable !== null"
      title="Disable this user?"
      confirm-label="Disable"
      confirm-color="error"
      @update:model-value="confirmDisable = null"
      @confirm="confirmDisable && toggleDisabled(confirmDisable, true)"
    >
      {{ confirmDisable?.displayName }} is signed out everywhere and can no longer sign in, use access
      links or connect TAK apps until enabled again.
    </ConfirmDialog>
    <ConfirmDialog
      :model-value="confirmSignOut !== null"
      title="Sign out everywhere?"
      confirm-label="Sign out"
      @update:model-value="confirmSignOut = null"
      @confirm="confirmSignOut && signOut(confirmSignOut)"
    >
      All browser sessions of {{ confirmSignOut?.displayName }} end. They can sign in again right away.
    </ConfirmDialog>
  </ViewContent>
</template>
