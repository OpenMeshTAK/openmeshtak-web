<script setup lang="ts">
import { mdiPlus } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { createRole, deleteRole, listRoles, updateRole, type EventRoleDto } from "./event-roles.api";

const props = defineProps<{ eventId: string; editable: boolean }>();

const roles = ref<EventRoleDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const dialogOpen = ref(false);
const editing = ref<EventRoleDto | null>(null);
const form = ref({ name: "", slug: "", description: "" });
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

const deleting = ref<EventRoleDto | null>(null);
const deleteError = ref<string | null>(null);

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
  form.value = { name: role?.name ?? "", slug: role?.slug ?? "", description: role?.description ?? "" };
  formError.value = null;
  formFields.value = {};
  dialogOpen.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const body = { name: form.value.name, slug: form.value.slug, description: form.value.description || null };
  try {
    if (editing.value === null) {
      await createRole(props.eventId, body);
    } else {
      await updateRole(props.eventId, editing.value.id, { ...body, version: editing.value.version });
    }
    dialogOpen.value = false;
    await load();
  } catch (caught: unknown) {
    formFields.value = fieldErrors(caught);
    formError.value = describeError(caught);
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
    await deleteRole(props.eventId, deleting.value.id);
    deleting.value = null;
    await load();
  } catch (caught: unknown) {
    deleteError.value = isApiProblem(caught, "ROLE_IN_USE")
      ? "Members still have this role. Move them to another role first."
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
        Every member has exactly one event role. Integrations refer to roles by their slug.
      </p>
      <v-btn v-if="editable" color="primary" :prepend-icon="mdiPlus" @click="open(null)">Add role</v-btn>
    </div>

    <v-alert v-if="deleteError" type="error" class="mb-4">{{ deleteError }}</v-alert>
    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="roles.length === 0" title="No roles yet" text="Add at least one role, for example Participant." />

    <v-card v-else>
      <v-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th class="d-none d-md-table-cell">Description</th>
            <th v-if="editable" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in roles" :key="role.id">
            <td>{{ role.name }}</td>
            <td><code>{{ role.slug }}</code></td>
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
          <v-text-field v-model="form.name" label="Name" :error-messages="messagesFor(formFields, 'name')" />
          <v-text-field
            v-model="form.slug"
            label="Slug"
            hint="Used by integrations, e.g. participant"
            persistent-hint
            class="mb-2"
            :error-messages="messagesFor(formFields, 'slug')"
          />
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
