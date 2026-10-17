<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import {
  mdiAccountCheck,
  mdiAccountGroup,
  mdiAccountOff,
  mdiAccountPlus,
  mdiEmailLock,
  mdiLinkVariant,
  mdiLogout,
  mdiPencil,
  mdiPinOutline,
} from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import DataTable from "@/shared/components/DataTable.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import CreateUserDialog from "./CreateUserDialog.vue";
import SetupLinkDialog from "./SetupLinkDialog.vue";
import UserGroupsDialog from "./UserGroupsDialog.vue";
import {
  listAllUsers,
  makeUserPermanent,
  revokeUserSessions,
  sendPasswordReset,
  setUserDisabled,
  updateUser,
  type UserAccountType,
  type UserDto,
} from "./users.api";

/**
 * Installation-wide user administration. Administrators never see or set passwords: new users
 * get a setup link to choose their own. Administrators edit the name and username, disable or
 * sign users out, and add users to user groups. Event membership stays on each event's Members tab.
 *
 * Permanent users stay until removed; event accounts belong to one event and are deleted when it is
 * archived, unless an administrator makes them permanent.
 */
const session = useSession();
const toast = useToast();

const users = ref<UserDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
/** Each action needs its own permission; see Core's `users.*` catalog. */
const can = {
  create: session.can("users.create"),
  edit: session.can("users.edit"),
  setEmail: session.can("users.set-email"),
  disable: session.can("users.disable"),
  signOut: session.can("users.sign-out"),
  passwordReset: session.can("users.password-reset"),
  setupLinks: session.can("users.setup-links"),
  groups: session.can("user-group-members.manage"),
};
const accountType = ref<"all" | UserAccountType>("all");
const accountTypes = [
  { value: "all", title: "All accounts" },
  { value: "permanent", title: "Permanent users" },
  { value: "event", title: "Event accounts" },
];

const editing = ref<UserDto | null>(null);
const newName = ref("");
const newUsername = ref("");
const newEmail = ref("");
const saving = ref(false);
const editError = ref("");
const confirmDisable = ref<UserDto | null>(null);
const confirmSignOut = ref<UserDto | null>(null);
const createOpen = ref(false);
const setupLinkFor = ref<UserDto | null>(null);
const groupsFor = ref<UserDto | null>(null);
const confirmPermanent = ref<UserDto | null>(null);

function onCreated(user: UserDto): void {
  users.value = [...users.value, user];
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    users.value = await listAllUsers();
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

const shownUsers = computed(() =>
  accountType.value === "all"
    ? users.value
    : users.value.filter((user) => (user.accountEvent === null ? "permanent" : "event") === accountType.value),
);

function statusLabel(user: UserDto): string {
  return user.disabled ? "Disabled" : user.passwordSet ? "Active" : "Setup pending";
}

function replace(updated: UserDto): void {
  users.value = users.value.map((user) => (user.id === updated.id ? updated : user));
}

function startEdit(user: UserDto): void {
  editing.value = user;
  newName.value = user.displayName;
  newUsername.value = user.username ?? "";
  newEmail.value = user.email ?? "";
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
  // Only send the address when it changed, so editors without users.set-email can still rename.
  const email = newEmail.value.trim().toLowerCase();
  const emailChange = user.username === null || email === (user.email ?? "") ? undefined : email === "" ? null : email;
  saving.value = true;
  editError.value = "";
  try {
    const updated = await updateUser(user, newName.value.trim(), username, emailChange);
    replace(updated);
    editing.value = null;
    toast.success(
      emailChange
        ? `${updated.displayName} was updated. A confirmation link was sent to ${emailChange}.`
        : `${updated.displayName} was updated.`,
    );
  } catch (caught: unknown) {
    editError.value = isApiProblem(caught, "EMAIL_TAKEN") ? "Another account already uses this email address." : describeError(caught);
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

async function makePermanent(user: UserDto): Promise<void> {
  confirmPermanent.value = null;
  try {
    replace(await makeUserPermanent(user.id));
    toast.success(`${user.displayName} is now a permanent user.`);
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

interface RowAction {
  label: string;
  icon: string;
  run: () => void;
  color?: string;
  disabled?: boolean;
}

/** Icon actions at the end of each row; each one only appears with the permission it needs. */
function rowActions(user: UserDto): RowAction[] {
  const actions: RowAction[] = [];
  if (can.edit) {
    actions.push({ label: "Edit", icon: mdiPencil, run: () => startEdit(user) });
  }
  if (can.groups) {
    actions.push({ label: "User groups", icon: mdiAccountGroup, run: () => (groupsFor.value = user) });
  }
  if (user.accountEvent !== null && session.can("event-accounts.manage", user.accountEvent.id)) {
    actions.push({ label: "Make permanent user", icon: mdiPinOutline, run: () => (confirmPermanent.value = user) });
  }
  if (can.setupLinks && !user.passwordSet) {
    actions.push({ label: "Create setup link", icon: mdiLinkVariant, run: () => (setupLinkFor.value = user) });
  }
  if (can.passwordReset) {
    actions.push({
      label: user.email === null ? "Password reset needs a confirmed email" : "Send password reset email",
      icon: mdiEmailLock,
      run: () => void resetPassword(user),
      disabled: user.email === null,
    });
  }
  if (can.signOut) {
    actions.push({ label: "Sign out everywhere", icon: mdiLogout, run: () => (confirmSignOut.value = user) });
  }
  if (can.disable) {
    actions.push(
      user.disabled
        ? { label: "Enable", icon: mdiAccountCheck, run: () => void toggleDisabled(user, false) }
        : { label: "Disable", icon: mdiAccountOff, run: () => (confirmDisable.value = user), color: "error" },
    );
  }
  return actions;
}

const showActions = computed(() => users.value.some((user) => rowActions(user).length > 0));

const headers = computed(() => [
  { title: "Name", key: "displayName" },
  { title: "Username", key: "username" },
  { title: "Email", key: "email" },
  {
    title: "Account",
    key: "account",
    value: (user: UserDto) => (user.accountEvent === null ? "Permanent" : `Event: ${user.accountEvent.name}`),
  },
  { title: "User groups", key: "userGroups", value: (user: UserDto) => user.userGroups.map(({ name }) => name).join(", ") },
  { title: "Status", key: "status", value: statusLabel },
  ...(showActions.value ? [{ title: "Actions", key: "actions", sortable: false, align: "end" as const }] : []),
]);

/** Permanent users need `users.create`; event accounts `member-accounts.create` for some event. */
const canCreateUsers = computed(() => can.create || session.can("member-accounts.create"));

onMounted(load);
</script>

<template>
  <ViewContent>
    <ViewHeader title="Users" subtitle="Everyone with an OpenMeshTak account. Permissions come from user groups.">
      <template #actions>
        <v-btn v-if="canCreateUsers" color="primary" :prepend-icon="mdiAccountPlus" @click="createOpen = true">Create user</v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="error" @retry="load" />
    <v-card v-else>
      <DataTable
        :headers="headers"
        :items="shownUsers"
        :searchable="true"
        search-label="Search by name, username, email, account or user group"
        :sort-by="[{ key: 'displayName', order: 'asc' }]"
        no-data-text="No users match the filters."
        hover
      >
        <template #toolbar>
          <v-select v-model="accountType" :items="accountTypes" label="Account type" density="compact" hide-details class="user-type" />
        </template>
        <template #[`item.displayName`]="{ item }"><span class="font-weight-medium">{{ item.displayName }}</span></template>
        <template #[`item.username`]="{ item }">
          <code v-if="item.username">{{ item.username }}</code>
          <span v-else class="text-medium-emphasis">—</span>
        </template>
        <template #[`item.email`]="{ item }">
          <span class="text-medium-emphasis">{{ item.email ?? "No local sign-in yet" }}</span>
        </template>
        <template #[`item.account`]="{ item }">
          <span v-if="item.accountEvent === null">Permanent</span>
          <router-link
            v-else
            v-tooltip:top="'Deleted when this event is archived'"
            :to="{ name: 'event-detail', params: { eventId: item.accountEvent.id } }"
            class="text-no-wrap"
          >
            Event: {{ item.accountEvent.name }}
          </router-link>
        </template>
        <template #[`item.userGroups`]="{ item }">
          <span v-if="item.userGroups.length === 0" class="text-medium-emphasis">—</span>
          <span v-else>{{ item.userGroups.map(({ name }) => name).join(", ") }}</span>
        </template>
        <template #[`item.status`]="{ item }">
          <v-chip v-if="item.disabled" size="small" color="error" variant="tonal" :prepend-icon="mdiAccountOff">Disabled</v-chip>
          <v-chip v-else-if="!item.passwordSet" size="small" color="warning" variant="tonal">Setup pending</v-chip>
          <v-chip v-else size="small" color="success" variant="tonal">Active</v-chip>
        </template>
        <template #[`item.actions`]="{ item }">
          <span class="text-no-wrap">
            <v-btn
              v-for="action in rowActions(item)"
              :key="action.label"
              v-tooltip:top="action.label"
              :icon="action.icon"
              :aria-label="`${action.label}: ${item.displayName}`"
              :color="action.color"
              :disabled="action.disabled === true"
              variant="text"
              size="small"
              @click="action.run"
            />
          </span>
        </template>
      </DataTable>
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
            The username and email address are set when this user first signs in.
          </p>
          <v-text-field
            v-if="editing?.username !== null"
            v-model="newEmail"
            type="email"
            label="Email (optional)"
            autocapitalize="none"
            spellcheck="false"
            :disabled="!can.setEmail"
            @keydown.enter="saveEdit"
          >
            <template #append-inner>
              <InfoHint label="About email">
                <p class="mb-2">
                  The person gets a link to confirm the address. Until then it receives no password reset emails.
                </p>
                <p>Changing it needs the "Set email addresses" permission. A previously confirmed address is told about the change.</p>
              </InfoHint>
            </template>
          </v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editing = null">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CreateUserDialog v-model="createOpen" @created="onCreated" />
    <UserGroupsDialog
      v-if="groupsFor"
      :user="groupsFor"
      :model-value="groupsFor !== null"
      @update:model-value="groupsFor = null"
      @changed="replace"
    />
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
    <ConfirmDialog
      :model-value="confirmPermanent !== null"
      title="Make this a permanent user?"
      confirm-label="Make permanent"
      @update:model-value="confirmPermanent = null"
      @confirm="confirmPermanent && makePermanent(confirmPermanent)"
    >
      {{ confirmPermanent?.displayName }} stays when {{ confirmPermanent?.accountEvent?.name }} is archived. Their event
      memberships and user groups do not change.
    </ConfirmDialog>
  </ViewContent>
</template>

<style scoped>
.user-type {
  flex: 0 1 220px;
  min-width: 180px;
}
</style>
