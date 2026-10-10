<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import SegmentedControl from "@/shared/components/SegmentedControl.vue";
import { computed, ref, watch } from "vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useSession } from "@/modules/auth/session";
import { listAllUsers, type UserDto } from "@/modules/user-groups/user-groups.api";
import OneTimeLinkReveal from "@/shared/components/OneTimeLinkReveal.vue";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import type { SetupLinkDto } from "@/modules/users/users.api";
import { createMember, createMemberAccount, syncMember } from "./members.api";

type Assignment = { id: string; slug: string; name: string };

const props = defineProps<{
  eventId: string;
  roles: Assignment[];
  groups: Assignment[];
  /** Users who are already members and therefore not offered again. */
  memberUserIds: string[];
  /** The event creates permanent users instead of event accounts. */
  permanentAccounts: boolean;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [outcome: "member" | "sync-issue"] }>();
const session = useSession();

/**
 * New people need `member-accounts.create`, existing users `members.manage` and `users.read`;
 * external identities need only `members.sync`.
 */
const canCreate = computed(() => session.can("member-accounts.create", props.eventId));
const canPickUsers = computed(() => session.can("users.read") && session.can("members.manage", props.eventId));
const canSync = computed(() => session.can("members.sync", props.eventId));
const sourceCount = computed(() => [canCreate.value, canPickUsers.value, canSync.value].filter(Boolean).length);

type Source = "new" | "user" | "external";
const sourceOptions = computed(() =>
  [
    { title: "New person", value: "new" as Source, shown: canCreate.value },
    { title: "Existing user", value: "user" as Source, shown: canPickUsers.value },
    { title: "External identity", value: "external" as Source, shown: canSync.value },
  ].filter(({ shown }) => shown),
);
const source = ref<Source>("new");
/** The new person's setup link, shown once after creating them and cleared on close. */
const created = ref<{ displayName: string; setupLink: SetupLinkDto } | null>(null);
const users = ref<UserDto[]>([]);
/** Captured on open so the list does not change while the dialog fades out after saving. */
const excludedUserIds = ref<string[]>([]);
const usersError = ref<string | null>(null);
const form = ref({
  userId: null as string | null,
  displayName: "",
  accountUsername: "",
  callsignOverride: "",
  provider: "discord",
  externalId: "",
  username: "",
  roleId: "",
  groupId: "",
});
const saving = ref(false);
const error = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

const selectableUsers = computed(() =>
  users.value
    .filter(({ id }) => !excludedUserIds.value.includes(id))
    .map((user) => ({ ...user, title: user.email ? `${user.displayName} (${user.email})` : user.displayName })),
);

async function loadUsers(): Promise<void> {
  usersError.value = null;
  try {
    users.value = await listAllUsers();
  } catch (caught: unknown) {
    usersError.value = describeError(caught);
  }
}

function usernameOrEmpty(value: string): true | string {
  return value.trim() === "" || usernameRule(normalizeUsernameInput(value));
}

watch(open, (isOpen) => {
  if (!isOpen) {
    created.value = null;
    return;
  }
  source.value = canCreate.value ? "new" : canPickUsers.value ? "user" : "external";
  excludedUserIds.value = [...props.memberUserIds];
  form.value = {
    userId: null,
    displayName: "",
    accountUsername: "",
    callsignOverride: "",
    provider: "discord",
    externalId: "",
    username: "",
    roleId: props.roles[0]?.id ?? "",
    groupId: props.groups[0]?.id ?? "",
  };
  error.value = null;
  fields.value = {};
  if (canPickUsers.value) {
    void loadUsers();
  }
});

function slugOf(items: Assignment[], id: string): string {
  return items.find((item) => item.id === id)?.slug ?? "";
}

function describeAddError(caught: unknown): string {
  if (isApiProblem(caught, "MEMBER_IDENTITY_CONFLICT")) {
    return "This callsign is already taken or too long. Set a callsign override or pick another group.";
  }
  if (isApiProblem(caught, "MEMBER_EXISTS")) {
    return "This user is already a member of this event.";
  }
  if (isApiProblem(caught, "USERNAME_TAKEN")) {
    return "That username is already in use. Choose another one.";
  }
  return describeError(caught);
}

/**
 * Existing users are added directly. External identities use the same idempotent upsert as
 * integrations; synchronizing never creates a password or session, the participant later signs in
 * with an access link.
 */
async function addMember(): Promise<"member" | "sync-issue"> {
  if (source.value === "new") {
    const username = normalizeUsernameInput(form.value.accountUsername);
    const result = await createMemberAccount(props.eventId, {
      displayName: form.value.displayName.trim(),
      ...(username === "" ? {} : { username }),
      eventRoleId: form.value.roleId,
      eventGroupId: form.value.groupId,
      callsignOverride: form.value.callsignOverride.trim() || null,
    });
    created.value = { displayName: result.user.displayName, setupLink: result.setupLink };
    return "member";
  }
  if (source.value === "user") {
    await createMember(props.eventId, {
      userId: form.value.userId ?? "",
      eventRoleId: form.value.roleId,
      eventGroupId: form.value.groupId,
      callsignOverride: form.value.callsignOverride.trim() || null,
    });
    return "member";
  }
  const result = await syncMember(props.eventId, form.value.provider.trim(), form.value.externalId.trim(), {
    username: form.value.username,
    eventRole: slugOf(props.roles, form.value.roleId),
    group: slugOf(props.groups, form.value.groupId),
  });
  return result.outcome;
}

const ready = computed(() => {
  if (source.value === "new") {
    return form.value.displayName.trim() !== "" && usernameOrEmpty(form.value.accountUsername) === true;
  }
  return source.value === "external" || form.value.userId !== null;
});

async function save(): Promise<void> {
  if (!ready.value) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const outcome = await addMember();
    // A new person's setup link stays visible until the dialog is closed.
    if (created.value === null) {
      open.value = false;
    }
    emit("saved", outcome);
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    error.value = describeAddError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">{{ created ? `Setup link for ${created.displayName}` : "Add member" }}</v-card-title>
      <v-card-text v-if="created">
        <OneTimeLinkReveal :url="created.setupLink.url" :expires-at="created.setupLink.expiresAt" label="Setup link">
          {{ created.displayName }} opens this link to choose a password. Share it privately; it is shown only now.
          You can create a new one from the Users page.
        </OneTimeLinkReveal>
      </v-card-text>
      <v-card-text v-else>
        <SegmentedControl v-if="sourceCount > 1" v-model="source" :options="sourceOptions" label="Who to add" size="default" class="mb-4" />

        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

        <template v-if="source === 'new'">
          <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
            <template v-if="permanentAccounts">
              Creates a permanent user. They get a setup link to choose their own password.
            </template>
            <template v-else>
              Creates an event account that is deleted when this event is archived. They get a setup link to
              choose their own password.
            </template>
          </p>
          <v-text-field
            v-model="form.displayName"
            label="Name"
            maxlength="100"
            autofocus
            :error-messages="messagesFor(fields, 'displayName')"
          />
          <v-text-field
            v-model="form.accountUsername"
            label="Username (optional)"
            autocapitalize="none"
            spellcheck="false"
            :rules="[usernameOrEmpty]"
            :error-messages="messagesFor(fields, 'username')"
          >
            <template #append-inner>
              <InfoHint label="About username" :text="`${USERNAME_HINT} Derived from the name when empty.`" />
            </template>
          </v-text-field>
        </template>

        <template v-else-if="source === 'user'">
          <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
            Adds someone who already has an OpenMeshTak account. Their name is used in the callsign.
          </p>
          <v-alert v-if="usersError" type="error" class="mb-4">{{ usersError }}</v-alert>
          <v-autocomplete
            v-model="form.userId"
            :items="selectableUsers"
            item-title="title"
            item-value="id"
            label="User"
            no-data-text="No users left to add"
            :error-messages="messagesFor(fields, 'userId')"
          />
        </template>

        <template v-else>
          <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
            Members are identified by their account in an external system, for example their Discord
            user ID. Adding the same identity again updates the existing member.
          </p>
          <div class="d-flex flex-wrap ga-4">
            <v-text-field v-model="form.provider" placeholder="discord" label="System" style="min-width: 160px" />
            <v-text-field v-model="form.externalId" label="External ID" style="min-width: 220px" />
          </div>
          <v-text-field
            v-model="form.username"
            label="Name"
            class="mb-2"
            :error-messages="messagesFor(fields, 'username')"
          >
            <template #append-inner>
              <InfoHint label="About name" text="Used in the callsign, e.g. Peter" />
            </template>
          </v-text-field>
        </template>

        <div class="d-flex flex-wrap ga-4">
          <v-select v-model="form.roleId" :items="roles" item-title="name" item-value="id" label="Role" style="min-width: 200px" />
          <v-select v-model="form.groupId" :items="groups" item-title="name" item-value="id" label="Group" style="min-width: 200px" />
        </div>
        <v-text-field
          v-if="source !== 'external'"
          v-model="form.callsignOverride"
          label="Callsign override (optional)"
          maxlength="39"
          :error-messages="messagesFor(fields, 'callsignOverride')"
        >
          <template #append-inner>
            <InfoHint label="About callsign override" text="Leave empty to use the group's callsign format" />
          </template>
        </v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ created ? "Done" : "Cancel" }}</v-btn>
        <v-btn
          v-if="!created"
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="!ready"
          @click="save"
        >
          {{ source === "new" ? "Create and add" : "Add member" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
