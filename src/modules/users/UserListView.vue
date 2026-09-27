<script setup lang="ts">
import { mdiAccountOff, mdiDotsVertical, mdiMagnify } from "@mdi/js";
import { onMounted, ref, watch } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { renameUser, revokeUserSessions, searchUsers, sendPasswordReset, setUserDisabled, type UserDto } from "./users.api";

/**
 * Installation-wide user administration. Administrators never see or set passwords; they rename,
 * disable or sign users out. Event membership stays on each event's Members tab.
 */
const session = useSession();
const toast = useToast();

const users = ref<UserDto[]>([]);
const nextCursor = ref<string | null>(null);
const search = ref("");
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const canManage = session.can("users.manage");

const renaming = ref<UserDto | null>(null);
const newName = ref("");
const confirmDisable = ref<UserDto | null>(null);
const confirmSignOut = ref<UserDto | null>(null);

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

function startRename(user: UserDto): void {
  renaming.value = user;
  newName.value = user.displayName;
}

async function saveName(): Promise<void> {
  const user = renaming.value;
  renaming.value = null;
  if (user === null || newName.value.trim() === "" || newName.value.trim() === user.displayName) {
    return;
  }
  try {
    replace(await renameUser(user, newName.value.trim()));
    toast.success("User renamed.");
  } catch (caught: unknown) {
    toast.error(caught);
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
    <ViewHeader title="Users" subtitle="Everyone with an OpenMeshTak account. Permissions come from user groups." />

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
            <th class="d-none d-md-table-cell">Email</th>
            <th>Status</th>
            <th v-if="canManage" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="font-weight-medium">{{ user.displayName }}</td>
            <td class="d-none d-md-table-cell text-medium-emphasis">{{ user.email ?? "No local sign-in yet" }}</td>
            <td>
              <v-chip v-if="user.disabled" size="small" color="error" variant="tonal" :prepend-icon="mdiAccountOff">Disabled</v-chip>
              <v-chip v-else size="small" color="success" variant="tonal">Active</v-chip>
            </td>
            <td v-if="canManage" class="text-right">
              <v-menu>
                <template #activator="{ props: menu }">
                  <v-btn v-bind="menu" :icon="mdiDotsVertical" variant="text" size="small" :aria-label="`Actions for ${user.displayName}`" />
                </template>
                <v-list density="compact">
                  <v-list-item title="Rename" @click="startRename(user)" />
                  <v-list-item title="Send password reset email" :disabled="user.email === null" @click="resetPassword(user)" />
                  <v-list-item title="Sign out everywhere" @click="confirmSignOut = user" />
                  <v-list-item v-if="user.disabled" title="Enable" @click="toggleDisabled(user, false)" />
                  <v-list-item v-else title="Disable" base-color="error" @click="confirmDisable = user" />
                </v-list>
              </v-menu>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="4" class="text-medium-emphasis">No users match the search.</td>
          </tr>
        </tbody>
      </v-table>
      <div v-if="nextCursor" class="d-flex justify-center pa-3">
        <v-btn variant="text" @click="load(true)">Load more</v-btn>
      </div>
    </v-card>

    <v-dialog :model-value="renaming !== null" max-width="420" @update:model-value="renaming = null">
      <v-card class="pa-2">
        <v-card-title>Rename user</v-card-title>
        <v-card-text>
          <v-text-field v-model="newName" label="Display name" maxlength="100" autofocus @keydown.enter="saveName" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="renaming = null">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="saveName">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
