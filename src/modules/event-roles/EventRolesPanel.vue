<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiDeleteOutline, mdiPencil, mdiPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import DataTable from "@/shared/components/DataTable.vue";
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
const form = ref<{
  name: string;
  slug: string;
  description: string;
  takRoleOverride: Schemas["TakRole"] | null;
  seesAllTakGroups: boolean;
}>({
  name: "",
  slug: "",
  description: "",
  takRoleOverride: null,
  seesAllTakGroups: false,
});
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

const deleting = ref<EventRoleDto | null>(null);

const headers = computed(() => [
  { title: "Name", key: "name" },
  { title: "Slug", key: "slug" },
  { title: "TAK role", key: "takRoleOverride", value: (role: EventRoleDto) => role.takRoleOverride ?? "From group" },
  { title: "Description", key: "description" },
  ...(props.editable ? [{ title: "Actions", key: "actions", sortable: false, align: "end" as const }] : []),
]);

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
    seesAllTakGroups: role?.seesAllTakGroups ?? false,
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
    seesAllTakGroups: form.value.seesAllTakGroups,
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
    <SectionHeader
      title="Roles"
      description="Every member has exactly one event role. Integrations refer to roles by their slug."
    >
      <template #actions>
        <v-btn v-if="editable" color="primary" :prepend-icon="mdiPlus" @click="open(null)">New role</v-btn>
      </template>
    </SectionHeader>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="roles.length === 0" title="No roles yet" text="Add at least one role, for example Participant." />

    <v-card v-else>
      <DataTable :headers="headers" :items="roles" search-label="Search roles" storage-key="event-roles">
        <template #[`item.slug`]="{ item }"><code>{{ item.slug }}</code></template>
        <template #[`item.takRoleOverride`]="{ item }">
          <span v-if="item.takRoleOverride">{{ item.takRoleOverride }}</span>
          <span v-else class="text-medium-emphasis">From group</span>
          <div v-if="item.seesAllTakGroups" class="text-body-small text-medium-emphasis">Sees all TAK groups</div>
        </template>
        <template #[`item.description`]="{ item }">
          <span class="text-medium-emphasis">{{ item.description }}</span>
        </template>
        <template #[`item.actions`]="{ item }">
          <span class="text-no-wrap">
            <v-btn v-tooltip:top="'Edit'" :icon="mdiPencil" :aria-label="`Edit: ${item.name}`" variant="text" size="small" @click="open(item)" />
            <v-btn v-tooltip:top="'Delete'" :icon="mdiDeleteOutline" :aria-label="`Delete: ${item.name}`" variant="text" size="small" color="error" @click="deleting = item" />
          </span>
        </template>
      </DataTable>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="520">
      <v-card class="pa-2">
        <v-card-title>{{ editing ? "Edit role" : "New role" }}</v-card-title>
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
          <div class="d-flex align-center mb-2">
            <v-checkbox v-model="form.seesAllTakGroups" label="Sees all TAK groups" hide-details density="compact" />
            <InfoHint
              label="About seeing all TAK groups"
              text="When the event shows members only their own group, members with this role still see and reach everyone, e.g. platoon leaders."
            />
          </div>
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
