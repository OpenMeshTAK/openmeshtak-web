<script setup lang="ts">
import { mdiPlus } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useSession } from "@/modules/auth/session";
import { suggestSlug } from "@/modules/events/slug";
import { createUserGroup, listUserGroups, type UserGroupDto } from "./user-groups.api";

const router = useRouter();
const session = useSession();
const groups = ref<UserGroupDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const dialogOpen = ref(false);
const form = ref({ name: "", slug: "" });
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

async function load(): Promise<void> {
  state.value = "loading";
  try {
    groups.value = await listUserGroups();
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function openDetail(group: UserGroupDto): void {
  void router.push({ name: "user-group-detail", params: { userGroupId: group.id } });
}

async function create(): Promise<void> {
  saving.value = true;
  formError.value = null;
  try {
    const created = await createUserGroup({ name: form.value.name, slug: form.value.slug, permissions: [] });
    dialogOpen.value = false;
    openDetail(created);
  } catch (caught: unknown) {
    formFields.value = fieldErrors(caught);
    formError.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-6">
    <PageHeader title="User groups" subtitle="Authorization groups. They are unrelated to tactical event groups such as Bravo.">
      <template #actions>
        <v-btn
          v-if="session.can('user-groups.manage')"
          color="primary"
          :prepend-icon="mdiPlus"
          @click="
            form = { name: '', slug: '' };
            formError = null;
            formFields = {};
            dialogOpen = true;
          "
        >
          New user group
        </v-btn>
      </template>
    </PageHeader>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="groups.length === 0" title="No user groups" />

    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Members</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="group in groups"
            :key="group.id"
            class="cursor-pointer"
            tabindex="0"
            @click="openDetail(group)"
            @keydown.enter="openDetail(group)"
          >
            <td>
              <span class="font-weight-medium">{{ group.name }}</span>
              <v-chip v-if="group.system" size="x-small" class="ml-2" label>System</v-chip>
            </td>
            <td>{{ group.memberCount }}</td>
            <td>{{ group.permissions.length }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card class="pa-2">
        <v-card-title>New user group</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-text-field
            v-model="form.name"
            label="Name"
            hint="e.g. Editors"
            persistent-hint
            class="mb-2"
            :error-messages="messagesFor(formFields, 'name')"
            @update:model-value="form.slug = suggestSlug($event)"
          />
          <v-text-field v-model="form.slug" label="Slug" :error-messages="messagesFor(formFields, 'slug')" />
          <p class="text-body-2 text-medium-emphasis mb-0">You add permissions and members on the next page.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="create">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
