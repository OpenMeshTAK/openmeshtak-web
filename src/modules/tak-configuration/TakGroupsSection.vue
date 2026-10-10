<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { listMembers, type EventMemberDto } from "@/modules/members/members.api";
import {
  createTakGroup,
  deleteTakGroup,
  getTakGroup,
  listTakGroups,
  updateTakGroup,
  type TakGroupDto,
  type TakGroupSummaryDto,
} from "./tak-groups.api";

/**
 * The event's free TAK groups for the advanced group mode. Each member is assigned per group to
 * receive what is sent into it (in) and/or to send into it (out).
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();
const session = useSession();

const groups = ref<TakGroupSummaryDto[]>([]);
const members = ref<EventMemberDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const dialogOpen = ref(false);
const editing = ref<TakGroupDto | null>(null);
const name = ref("");
const description = ref("");
const assignment = ref<Record<string, { receive: boolean; send: boolean }>>({});
const memberFilter = ref("");
const saving = ref(false);
const fields = ref<Record<string, string>>({});
const deleting = ref<TakGroupSummaryDto | null>(null);

const visibleMembers = computed(() => {
  const filter = memberFilter.value.trim().toLowerCase();
  return members.value.filter((member) =>
    filter === "" ? true : [member.displayName, member.callsign, member.eventGroup.name].some((text) => text.toLowerCase().includes(filter)),
  );
});

async function load(): Promise<void> {
  state.value = "loading";
  try {
    [groups.value, members.value] = await Promise.all([
      listTakGroups(props.eventId),
      session.can("members.read", props.eventId) ? listMembers(props.eventId) : Promise.resolve([]),
    ]);
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function assigned(memberId: string, direction: "receive" | "send"): boolean {
  return assignment.value[memberId]?.[direction] ?? false;
}

function assign(memberId: string, direction: "receive" | "send", value: boolean | null): void {
  const current = assignment.value[memberId] ?? { receive: false, send: false };
  assignment.value = { ...assignment.value, [memberId]: { ...current, [direction]: value === true } };
}

async function open(summary: TakGroupSummaryDto | null): Promise<void> {
  fields.value = {};
  memberFilter.value = "";
  try {
    editing.value = summary === null ? null : await getTakGroup(props.eventId, summary.id);
  } catch (caught: unknown) {
    toast.error(caught);
    return;
  }
  name.value = editing.value?.name ?? "";
  description.value = editing.value?.description ?? "";
  assignment.value = Object.fromEntries((editing.value?.members ?? []).map(({ memberId, receive, send }) => [memberId, { receive, send }]));
  dialogOpen.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  fields.value = {};
  const assigned = Object.entries(assignment.value)
    .filter(([, { receive, send }]) => receive || send)
    .map(([memberId, { receive, send }]) => ({ memberId, receive, send }));
  const body = { name: name.value, description: description.value || null, members: assigned };
  try {
    if (editing.value === null) {
      await createTakGroup(props.eventId, body);
    } else {
      await updateTakGroup(props.eventId, editing.value.id, { ...body, version: editing.value.version });
    }
    dialogOpen.value = false;
    toast.success("TAK group saved. Connected apps follow within seconds.");
    await load();
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  if (deleting.value === null) {
    return;
  }
  try {
    await deleteTakGroup(props.eventId, deleting.value.id);
    toast.success("TAK group deleted.");
    deleting.value = null;
    await load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-center mb-2">
      <div class="text-title-small flex-grow-1">Groups</div>
      <v-btn v-if="editable" size="small" variant="tonal" @click="open(null)">New TAK group</v-btn>
    </div>

    <v-skeleton-loader v-if="state === 'loading'" type="table-row@3" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState
      v-else-if="groups.length === 0"
      title="No TAK groups yet"
      text="Add groups such as Alpha, Bravo or Medics and choose who receives and sends in each."
    />
    <v-card v-else>
      <v-table density="comfortable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Receive</th>
            <th>Send</th>
            <th class="d-none d-md-table-cell">Description</th>
            <th v-if="editable" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in groups" :key="group.id">
            <td>{{ group.name }}</td>
            <td>{{ group.receiverCount }}</td>
            <td>{{ group.senderCount }}</td>
            <td class="d-none d-md-table-cell text-medium-emphasis">{{ group.description }}</td>
            <td v-if="editable" class="text-right text-no-wrap">
              <v-btn variant="text" size="small" @click="open(group)">Edit</v-btn>
              <v-btn variant="text" size="small" color="error" @click="deleting = group">Delete</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="720" scrollable>
      <v-card>
        <v-card-title>{{ editing === null ? "New TAK group" : `Edit ${editing.name}` }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="name" label="Name" :error-messages="messagesFor(fields, 'name')" />
          <v-text-field v-model="description" label="Description (optional)" :error-messages="messagesFor(fields, 'description')" />
          <div class="text-title-small mt-2 mb-1">Members</div>
          <p class="text-body-small text-medium-emphasis mb-2">
            Receive: the member gets what others send into this group. Send: what the member sends goes into this group.
          </p>
          <v-text-field v-model="memberFilter" label="Filter members" density="compact" clearable hide-details class="mb-2" />
          <div v-for="message in messagesFor(fields, 'members')" :key="message" class="text-error text-body-small mb-2">{{ message }}</div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Member</th>
                <th>Event group</th>
                <th class="text-center">Receive</th>
                <th class="text-center">Send</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in visibleMembers" :key="member.id">
                <td>
                  {{ member.callsign }}
                  <div class="text-body-small text-medium-emphasis">{{ member.displayName }}</div>
                </td>
                <td>{{ member.eventGroup.name }}</td>
                <td class="text-center">
                  <v-checkbox-btn
                    :model-value="assigned(member.id, 'receive')"
                    class="d-inline-flex"
                    :aria-label="`${member.callsign} receives`"
                    @update:model-value="assign(member.id, 'receive', $event)"
                  />
                </td>
                <td class="text-center">
                  <v-checkbox-btn
                    :model-value="assigned(member.id, 'send')"
                    class="d-inline-flex"
                    :aria-label="`${member.callsign} sends`"
                    @update:model-value="assign(member.id, 'send', $event)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      :model-value="deleting !== null"
      title="Delete this TAK group?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="deleting = null"
      @confirm="confirmDelete"
    >
      The TAK group {{ deleting?.name }} and its member assignments are removed. Connected apps follow within seconds.
    </ConfirmDialog>
  </div>
</template>
