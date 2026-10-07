<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { computed, ref, watch } from "vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useSession } from "@/modules/auth/session";
import { listAllUsers, type UserDto } from "@/modules/user-groups/user-groups.api";
import { createMember, syncMember } from "./members.api";

type Assignment = { id: string; slug: string; name: string };

const props = defineProps<{
  eventId: string;
  roles: Assignment[];
  groups: Assignment[];
  /** Users who are already members and therefore not offered again. */
  memberUserIds: string[];
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [outcome: "member" | "sync-issue"] }>();
const session = useSession();

/** Picking an existing user needs `users.read`; external identities need only `members.sync`. */
const canPickUsers = computed(() => session.can("users.read") && session.can("members.manage", props.eventId));
const canSync = computed(() => session.can("members.sync", props.eventId));

const source = ref<"user" | "external">("user");
const users = ref<UserDto[]>([]);
/** Captured on open so the list does not change while the dialog fades out after saving. */
const excludedUserIds = ref<string[]>([]);
const usersError = ref<string | null>(null);
const form = ref({
  userId: null as string | null,
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

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  source.value = canPickUsers.value ? "user" : "external";
  excludedUserIds.value = [...props.memberUserIds];
  form.value = {
    userId: null,
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
  return describeError(caught);
}

/**
 * Existing users are added directly. External identities use the same idempotent upsert as
 * integrations; synchronizing never creates a password or session, the participant later signs in
 * with an access link.
 */
async function addMember(): Promise<"member" | "sync-issue"> {
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

async function save(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const outcome = await addMember();
    open.value = false;
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
      <v-card-title>Add member</v-card-title>
      <v-card-text>
        <v-btn-toggle
          v-if="canPickUsers && canSync"
          v-model="source"
          mandatory
          density="compact"
          variant="outlined"
          divided
          class="mb-4"
        >
          <v-btn value="user">OpenMeshTak user</v-btn>
          <v-btn value="external">External identity</v-btn>
        </v-btn-toggle>

        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

        <template v-if="source === 'user'">
          <p class="text-body-2 text-medium-emphasis mb-4">
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
          <p class="text-body-2 text-medium-emphasis mb-4">
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
          v-if="source === 'user'"
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
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="source === 'user' && form.userId === null"
          @click="save"
        >
          Add member
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
