<script setup lang="ts">
import { mdiPlus, mdiRobotOutline } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { listAllEvents } from "@/modules/events/events.api";
import { createServiceAccount, listServiceAccounts, type ServiceAccountDto } from "./service-accounts.api";

const router = useRouter();
const accounts = ref<ServiceAccountDto[]>([]);
const events = ref<{ id: string; name: string }[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const dialogOpen = ref(false);
const form = ref({ name: "", description: "" });
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedAccounts, loadedEvents] = await Promise.all([listServiceAccounts(), listAllEvents()]);
    accounts.value = loadedAccounts;
    events.value = loadedEvents.map(({ id, name }) => ({ id, name }));
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function openCreate(): void {
  form.value = { name: "", description: "" };
  grants.value = [{ permission: "members.sync", eventId: events.value[0]?.id ?? null }];
  formError.value = null;
  formFields.value = {};
  dialogOpen.value = true;
}

async function create(): Promise<void> {
  saving.value = true;
  formError.value = null;
  try {
    const created = await createServiceAccount({
      name: form.value.name,
      description: form.value.description || null,
      permissions: grants.value,
    });
    dialogOpen.value = false;
    await router.push({ name: "service-account-detail", params: { serviceAccountId: created.id } });
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
  <v-container fluid class="py-6 px-6">
    <PageHeader title="Service accounts" subtitle="Machine identities for bots and portals. They never act as a user.">
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">New service account</v-btn>
      </template>
    </PageHeader>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState
      v-else-if="accounts.length === 0"
      :icon="mdiRobotOutline"
      title="No service accounts"
      text="Create one for each integration, such as a Discord bot, with only the permissions it needs."
    />

    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="account in accounts"
            :key="account.id"
            class="cursor-pointer"
            tabindex="0"
            @click="router.push({ name: 'service-account-detail', params: { serviceAccountId: account.id } })"
            @keydown.enter="router.push({ name: 'service-account-detail', params: { serviceAccountId: account.id } })"
          >
            <td>
              <div class="font-weight-medium">{{ account.name }}</div>
              <div v-if="account.description" class="text-caption text-medium-emphasis">{{ account.description }}</div>
            </td>
            <td>
              <v-chip :color="account.status === 'active' ? 'success' : 'secondary'" size="small" variant="tonal" label>
                {{ account.status === "active" ? "Active" : "Disabled" }}
              </v-chip>
            </td>
            <td>{{ account.permissions.length }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="680" scrollable>
      <v-card class="pa-2">
        <v-card-title>New service account</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-text-field v-model="form.name" label="Name" hint="e.g. Terra Bot" persistent-hint class="mb-2" :error-messages="messagesFor(formFields, 'name')" />
          <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow class="mb-2" />
          <div class="text-subtitle-2 mb-2">Permissions</div>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Grant only what the integration needs and limit it to specific events where possible. You
            can only grant permissions you hold yourself.
          </p>
          <PermissionGrantEditor v-model="grants" :events="events" />
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
