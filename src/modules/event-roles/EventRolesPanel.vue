<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiPlus } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import type { Schemas } from "@/shared/api/types";
import { takRoleOptions } from "@/modules/event-groups/provisioning-options";
import { suggestSlug } from "@/modules/events/slug";
import { createRole, deleteRole, listRoles, updateRole, type EventRoleDto } from "./event-roles.api";

const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

const roles = ref<EventRoleDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const dialogOpen = ref(false);
const editing = ref<EventRoleDto | null>(null);
const form = ref<{ name: string; slug: string; description: string; takRoleOverride: Schemas["TakRole"] | null }>({
  name: "",
  slug: "",
  description: "",
  takRoleOverride: null,
});
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

const deleting = ref<EventRoleDto | null>(null);

const takRoleItems = [
  { title: "Use the group's TAK role", value: null },
  ...takRoleOptions.map((role) => ({ title: role, value: role })),
];

async function load(): Promise<void> {
  state.value = "loading";
  try {
    roles.value = await listRoles(props.eventId);
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function open(role: EventRoleDto | null): void {
  editing.value = role;
  form.value = {
    name: role?.name ?? "",
    slug: role?.slug ?? "",
    description: role?.description ?? "",
    takRoleOverride: role?.takRoleOverride ?? null,
  };
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
    takRoleOverride: form.value.takRoleOverride,
  };
  try {
    if (editing.value === null) {
      await createRole(props.eventId, body);
    } else {
      await updateRole(props.eventId, editing.value.id, { ...body, version: editing.value.version });
    }
    dialogOpen.value = false;
    toast.success(editing.value === null ? `Role ${form.value.name} was added.` : `Role ${form.value.name} was updated.`);
    await load();
  } catch (caught: unknown) {
    formFields.value = fieldErrors(caught);
    formError.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  const target = deleting.value;
  deleting.value = null;
  if (target === null) {
    return;
  }
  try {
    await deleteRole(props.eventId, target.id);
    toast.success(`Role ${target.name} was deleted.`);
    await load();
  } catch (caught: unknown) {
    toast.error(isApiProblem(caught, "ROLE_IN_USE") ? "Members still have this role. Move them to another role first." : caught);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <p class="text-body-medium text-medium-emphasis flex-grow-1 my-0">
        Every member has exactly one event role. Integrations refer to roles by their slug.
      </p>
      <v-btn v-if="editable" color="primary" :prepend-icon="mdiPlus" @click="open(null)">Add role</v-btn>
    </div>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="roles.length === 0" title="No roles yet" text="Add at least one role, for example Participant." />

    <v-card v-else>
      <v-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>TAK role</th>
            <th class="d-none d-md-table-cell">Description</th>
            <th v-if="editable" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in roles" :key="role.id">
            <td>{{ role.name }}</td>
            <td><code>{{ role.slug }}</code></td>
            <td>
              <span v-if="role.takRoleOverride">{{ role.takRoleOverride }}</span>
              <span v-else class="text-medium-emphasis">From group</span>
            </td>
            <td class="d-none d-md-table-cell text-medium-emphasis">{{ role.description }}</td>
            <td v-if="editable" class="text-right text-no-wrap">
              <v-btn variant="text" size="small" @click="open(role)">Edit</v-btn>
              <v-btn variant="text" size="small" color="error" @click="deleting = role">Delete</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="520">
      <v-card class="pa-2">
        <v-card-title>{{ editing ? "Edit role" : "Add role" }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-text-field
            v-model="form.name"
            label="Name"
            :error-messages="messagesFor(formFields, 'name')"
            @update:model-value="!editing && (form.slug = suggestSlug($event))"
          />
          <v-text-field
            v-model="form.slug"
            label="Slug"
            class="mb-2"
            :error-messages="messagesFor(formFields, 'slug')"
          >
            <template #append-inner>
              <InfoHint label="About slug" text="Used by integrations, e.g. participant" />
            </template>
          </v-text-field>
          <v-select
            v-model="form.takRoleOverride"
            :items="takRoleItems"
            label="TAK role"
            class="mb-4"
            :error-messages="messagesFor(formFields, 'takRoleOverride')"
          >
            <template #append-inner>
              <InfoHint label="About the TAK role" text="Replaces the group's TAK role for members with this role, e.g. Team Lead for platoon leaders." />
            </template>
          </v-select>
          <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow />
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
      title="Delete this role?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="deleting = null"
      @confirm="confirmDelete"
    >
      The role {{ deleting?.name }} is removed from this event. Roles that members still use cannot be
      deleted.
    </ConfirmDialog>
  </div>
</template>
