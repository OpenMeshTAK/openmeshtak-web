<script setup lang="ts">
import { mdiPlus } from "@mdi/js";
import { onMounted, ref, toRaw } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import GroupProvisioningFields from "./components/GroupProvisioningFields.vue";
import {
  createGroup,
  deleteGroup,
  listGroups,
  updateGroup,
  type EventGroupDto,
  type GroupProvisioning,
} from "./event-groups.api";

const props = defineProps<{ eventId: string; editable: boolean }>();

const groups = ref<EventGroupDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const dialogOpen = ref(false);
const editing = ref<EventGroupDto | null>(null);
const form = ref({ name: "", slug: "", description: "" });
const provisioning = ref<GroupProvisioning>(defaultProvisioning(""));
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

const deleting = ref<EventGroupDto | null>(null);
const deleteError = ref<string | null>(null);

/** Mirrors Core's documented defaults so the form starts in a sensible state. */
function defaultProvisioning(slug: string): GroupProvisioning {
  return {
    callsignFormat: "{username}",
    shortNamePrefix: slug.charAt(0).toUpperCase() || null,
    tak: { team: "Cyan", role: "Team Member", serverGroups: [] },
    meshtastic: { deviceRole: "CLIENT", channels: [] },
    missionGroups: [],
  };
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    groups.value = await listGroups(props.eventId);
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function open(group: EventGroupDto | null): void {
  editing.value = group;
  form.value = { name: group?.name ?? "", slug: group?.slug ?? "", description: group?.description ?? "" };
  // `group` comes from reactive state and structuredClone cannot copy Vue proxies.
  provisioning.value = structuredClone(group === null ? defaultProvisioning("") : toRaw(group).provisioning);
  formError.value = null;
  formFields.value = {};
  dialogOpen.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const body = {
    name: form.value.name,
    slug: form.value.slug,
    description: form.value.description || null,
    provisioning: provisioning.value,
  };
  try {
    if (editing.value === null) {
      await createGroup(props.eventId, body);
    } else {
      await updateGroup(props.eventId, editing.value.id, { ...body, version: editing.value.version });
    }
    dialogOpen.value = false;
    await load();
  } catch (caught: unknown) {
    formFields.value = fieldErrors(caught);
    formError.value = isApiProblem(caught, "MEMBER_IDENTITY_CONFLICT")
      ? "This change would give members duplicate or too long callsigns or short names."
      : describeError(caught);
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  if (deleting.value === null) {
    return;
  }
  deleteError.value = null;
  try {
    await deleteGroup(props.eventId, deleting.value.id);
    deleting.value = null;
    await load();
  } catch (caught: unknown) {
    deleteError.value = isApiProblem(caught, "GROUP_IN_USE")
      ? "Members are still in this group. Move them to another group first."
      : describeError(caught);
    deleting.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <p class="text-body-2 text-medium-emphasis flex-grow-1 mb-0">
        Groups are tactical units such as Bravo. They define callsigns, TAK team and Meshtastic
        settings for their members; they never grant administrative rights.
      </p>
      <v-btn v-if="editable" color="primary" :prepend-icon="mdiPlus" @click="open(null)">Add group</v-btn>
    </div>

    <v-alert v-if="deleteError" type="error" class="mb-4">{{ deleteError }}</v-alert>
    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="groups.length === 0" title="No groups yet" text="Add at least one group, for example Bravo." />

    <v-card v-else>
      <v-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Callsign</th>
            <th>TAK</th>
            <th>Short names</th>
            <th v-if="editable" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in groups" :key="group.id">
            <td>{{ group.name }}</td>
            <td><code>{{ group.slug }}</code></td>
            <td>{{ group.provisioning.callsignFormat }}</td>
            <td>{{ group.provisioning.tak.team }} · {{ group.provisioning.tak.role }}</td>
            <td>
              <span v-if="group.provisioning.shortNamePrefix">{{ group.provisioning.shortNamePrefix }}1, {{ group.provisioning.shortNamePrefix }}2, …</span>
              <v-chip v-else color="warning" size="small" variant="tonal" label>Prefix missing</v-chip>
            </td>
            <td v-if="editable" class="text-right text-no-wrap">
              <v-btn variant="text" size="small" @click="open(group)">Edit</v-btn>
              <v-btn variant="text" size="small" color="error" @click="deleting = group">Delete</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="640" scrollable>
      <v-card class="pa-2">
        <v-card-title>{{ editing ? "Edit group" : "Add group" }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-text-field v-model="form.name" label="Name" :error-messages="messagesFor(formFields, 'name')" />
          <v-text-field
            v-model="form.slug"
            label="Slug"
            hint="Used by integrations, e.g. bravo"
            persistent-hint
            class="mb-2"
            :error-messages="messagesFor(formFields, 'slug')"
            @update:model-value="!editing && (provisioning.shortNamePrefix = $event.charAt(0).toUpperCase() || null)"
          />
          <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow class="mb-2" />
          <GroupProvisioningFields v-model="provisioning" :errors="formFields" />
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
      title="Delete this group?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="deleting = null"
      @confirm="confirmDelete"
    >
      The group {{ deleting?.name }} is removed from this event. Groups that still have members cannot
      be deleted.
    </ConfirmDialog>
  </div>
</template>
