<script setup lang="ts">
import { mdiArrowLeft } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { listAllEvents } from "@/modules/events/events.api";
import ApiKeysCard from "./components/ApiKeysCard.vue";
import ApiClientStatusChip from "./components/ApiClientStatusChip.vue";
import { useToast } from "@/shared/feedback/toast";
import { getApiClient, updateApiClient, type ApiClientDto } from "./api-clients.api";

const route = useRoute();
const apiClientId = computed(() => String(route.params.apiClientId));

const form = ref({ name: "", description: "", status: "active" as Schemas["ApiClientStatus"] });
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const toast = useToast();
const saving = useSubmission();

function show(client: ApiClientDto): ApiClientDto {
  form.value = { name: client.name, description: client.description ?? "", status: client.status };
  grants.value = structuredClone(client.permissions);
  return client;
}

const page = useAsyncData(async () => {
  const [client, events] = await Promise.all([getApiClient(apiClientId.value), listAllEvents()]);
  return { client: show(client), events: events.map(({ id, name }) => ({ id, name })) };
}, null);

async function save(): Promise<void> {
  const current = page.data.value;
  if (current === null) {
    return;
  }
  const saved = await saving.run(async () => {
    current.client = show(
      await updateApiClient(current.client.id, {
        version: current.client.version,
        name: form.value.name,
        description: form.value.description || null,
        status: form.value.status,
        permissions: grants.value,
      }),
    );
  });
  if (saved !== null) {
    toast.success("Saved. Changes apply to all keys immediately.");
  } else {
    toast.error(saving.error.value);
  }
}

onMounted(page.load);
</script>

<template>
  <div>
    <v-btn :prepend-icon="mdiArrowLeft" :to="{ name: 'api-clients' }" variant="text" class="mb-2 ms-n3">API access</v-btn>
    <v-skeleton-loader v-if="page.state.value === 'loading'" type="heading, article" />
    <ErrorState v-else-if="page.state.value === 'error'" :message="page.error.value" @retry="page.load" />
    <template v-else-if="page.data.value">
      <ViewHeader :title="page.data.value.client.name" subtitle="API client">
        <template #actions><ApiClientStatusChip :status="page.data.value.client.status" /></template>
      </ViewHeader>

      <v-card class="pa-5 mb-6">
        <div class="text-title-medium font-weight-medium mb-4">Settings and permissions</div>
        <v-text-field v-model="form.name" label="Name" />
        <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow />
        <v-switch
          :model-value="form.status === 'active'"
          color="success"
          label="Active (disabling blocks every key immediately)"
          inset
          @update:model-value="form.status = $event ? 'active' : 'disabled'"
        />
        <PermissionGrantEditor v-model="grants" :events="page.data.value.events" />
        <v-btn color="primary" class="mt-4" :loading="saving.submitting.value" @click="save">Save changes</v-btn>
      </v-card>

      <ApiKeysCard :api-client-id="apiClientId" />
    </template>
  </div>
</template>
