<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import SegmentedControl from "@/shared/components/SegmentedControl.vue";
import { computed, ref, watch } from "vue";
import OneTimeLinkReveal from "@/shared/components/OneTimeLinkReveal.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { normalizeUsernameInput, USERNAME_HINT, usernameRule } from "@/shared/forms/username";
import { useSession } from "@/modules/auth/session";
import { listGroups, type EventGroupDto } from "@/modules/event-groups/event-groups.api";
import { listRoles, type EventRoleDto } from "@/modules/event-roles/event-roles.api";
import { listAllEvents, type EventListItem } from "@/modules/events/events.api";
import { createMemberAccount } from "@/modules/members/members.api";
import { createUser, type SetupLinkDto, type UserDto } from "./users.api";

/**
 * Creates a user without a password. The person receives a single-use setup link and chooses
 * their own password, so administrators never know it. The link lives only in this dialog's
 * memory and is cleared when it closes.
 *
 * A permanent user stays until an administrator removes them. An event account is created as a
 * member of one event and deleted when that event is archived.
 */
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ created: [user: UserDto] }>();
const session = useSession();

/** Permanent users need `users.create`; event accounts `member-accounts.create` for the event. */
const canPermanent = session.can("users.create");
const canEvent = session.can("member-accounts.create");
const defaultKind = (): "permanent" | "event" => (canPermanent ? "permanent" : "event");
const kind = ref<"permanent" | "event">(defaultKind());
const KIND_OPTIONS = [
  { title: "Permanent user", value: "permanent" as const },
  { title: "Event account", value: "event" as const },
];
const displayName = ref("");
const username = ref("");
const saving = ref(false);
const error = ref<string | null>(null);
const created = ref<{ user: UserDto; setupLink: SetupLinkDto } | null>(null);

/** Events the administrator may add members to; archived events take no new members. */
const events = ref<EventListItem[]>([]);
const eventId = ref<string | null>(null);
const roles = ref<EventRoleDto[]>([]);
const groups = ref<EventGroupDto[]>([]);
const roleId = ref<string | null>(null);
const groupId = ref<string | null>(null);
const eventsError = ref<string | null>(null);

const selectedEvent = computed(() => events.value.find(({ id }) => id === eventId.value) ?? null);

function usernameOrEmpty(value: string): true | string {
  return value.trim() === "" || usernameRule(normalizeUsernameInput(value));
}

const ready = computed(
  () =>
    displayName.value.trim() !== "" &&
    usernameOrEmpty(username.value) === true &&
    (kind.value === "permanent" || (roleId.value !== null && groupId.value !== null)),
);

async function loadEvents(): Promise<void> {
  eventsError.value = null;
  try {
    events.value = (await listAllEvents()).filter(
      (event) => event.status !== "archived" && session.can("member-accounts.create", event.id),
    );
    eventId.value ??= events.value.find(({ status }) => status === "active")?.id ?? events.value[0]?.id ?? null;
  } catch (caught: unknown) {
    eventsError.value = describeError(caught);
  }
}

watch(
  kind,
  (next) => {
    if (next === "event" && events.value.length === 0) {
      void loadEvents();
    }
  },
  { immediate: true },
);

watch(eventId, async (id) => {
  roles.value = [];
  groups.value = [];
  roleId.value = null;
  groupId.value = null;
  if (id === null) {
    return;
  }
  try {
    [roles.value, groups.value] = await Promise.all([listRoles(id), listGroups(id)]);
    roleId.value = roles.value[0]?.id ?? null;
    groupId.value = groups.value[0]?.id ?? null;
  } catch (caught: unknown) {
    eventsError.value = describeError(caught);
  }
});

async function create(name: string, chosen: string | null): Promise<{ user: UserDto; setupLink: SetupLinkDto }> {
  if (kind.value === "permanent" || eventId.value === null) {
    return createUser(name, chosen);
  }
  const result = await createMemberAccount(eventId.value, {
    displayName: name,
    ...(chosen === null ? {} : { username: chosen }),
    eventRoleId: roleId.value ?? "",
    eventGroupId: groupId.value ?? "",
  });
  return { user: result.user, setupLink: result.setupLink };
}

async function submit(): Promise<void> {
  if (!ready.value) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const chosen = normalizeUsernameInput(username.value);
    created.value = await create(displayName.value.trim(), chosen === "" ? null : chosen);
    emit("created", created.value.user);
  } catch (caught: unknown) {
    error.value = isApiProblem(caught, "USERNAME_TAKEN")
      ? "That username is already in use. Choose another one."
      : isApiProblem(caught, "MEMBER_IDENTITY_CONFLICT")
        ? "The callsign for this name is already taken in that group. Pick another group or add them from the event's Members tab with a callsign override."
        : describeError(caught);
  } finally {
    saving.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    kind.value = defaultKind();
    displayName.value = "";
    username.value = "";
    error.value = null;
    created.value = null;
  }
});
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">{{ created ? `Setup link for ${created.user.displayName}` : "Create user" }}</v-card-title>
      <v-card-text>
        <OneTimeLinkReveal v-if="created" :url="created.setupLink.url" :expires-at="created.setupLink.expiresAt" label="Setup link">
          Anyone with this link can set up the account of {{ created.user.displayName }}. Share it
          privately. It is shown only now; you can create a new one from the user's actions.
        </OneTimeLinkReveal>
        <v-form v-else @submit.prevent="submit">
          <SegmentedControl v-if="canPermanent && canEvent" v-model="kind" :options="KIND_OPTIONS" label="Account kind" size="default" class="mb-4" />
          <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
            <template v-if="kind === 'permanent'">
              Stays until you remove it. Add them to user groups or events to give them access.
            </template>
            <template v-else>
              Joins one event as a member and is deleted when that event is archived. Good for one-off
              participants.
            </template>
            The person gets a setup link, valid for seven days, to choose their own password.
          </p>
          <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
          <v-text-field v-model="displayName" label="Name" maxlength="100" autofocus />
          <v-text-field
            v-model="username"
            label="Username (optional)"
            autocapitalize="none"
            spellcheck="false"
            :rules="[usernameOrEmpty]"
          >
            <template #append-inner>
              <InfoHint label="About username" :text="`${USERNAME_HINT} Derived from the name when empty.`" />
            </template>
          </v-text-field>

          <template v-if="kind === 'event'">
            <v-alert v-if="eventsError" type="error" density="compact" class="mb-4">{{ eventsError }}</v-alert>
            <v-select
              v-model="eventId"
              :items="events"
              item-title="name"
              item-value="id"
              label="Event"
              no-data-text="No events you can add members to"
            >
              <template v-if="selectedEvent?.permanentAccounts" #append-inner>
                <InfoHint
                  tone="warning"
                  label="This event keeps its accounts"
                  text="This event creates permanent users, so the account stays after the event is archived."
                />
              </template>
            </v-select>
            <div class="d-flex flex-wrap ga-4">
              <v-select v-model="roleId" :items="roles" item-title="name" item-value="id" label="Role" style="min-width: 200px" />
              <v-select v-model="groupId" :items="groups" item-title="name" item-value="id" label="Group" style="min-width: 200px" />
            </div>
          </template>
          <button type="submit" hidden />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ created ? "Done" : "Cancel" }}</v-btn>
        <v-btn v-if="!created" color="primary" variant="flat" :loading="saving" :disabled="!ready" @click="submit">
          Create user
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
