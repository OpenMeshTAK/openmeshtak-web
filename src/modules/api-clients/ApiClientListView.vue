<script setup lang="ts">
import { mdiPlus, mdiRobotOutline } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { listAllEvents } from "@/modules/events/events.api";
import CreateApiClientDialog from "./components/CreateApiClientDialog.vue";
import ApiClientStatusChip from "./components/ApiClientStatusChip.vue";
import { listApiClients, type ApiClientDto } from "./api-clients.api";

const router = useRouter();
const page = useAsyncData(
  async () => {
    const [clients, events] = await Promise.all([listApiClients(), listAllEvents()]);
    return { clients, events: events.map(({ id, name }) => ({ id, name })) };
  },
  { clients: [] as ApiClientDto[], events: [] as { id: string; name: string }[] },
);
const createOpen = ref(false);

function open(client: ApiClientDto): void {
  void router.push({ name: "api-client-detail", params: { apiClientId: client.id } });
}

onMounted(page.load);
</script>

<template>
  <div>
    <ViewHeader title="API access" subtitle="API clients for bots and portals, each with its own permissions and API keys. They never act as a user.">
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="createOpen = true">New API client</v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="page.state.value === 'loading'" type="table" />
    <v-alert v-else-if="page.state.value === 'error'" type="error">{{ page.error.value }}</v-alert>
    <EmptyState
      v-else-if="page.data.value.clients.length === 0"
      :icon="mdiRobotOutline"
      title="No API clients"
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
            v-for="client in page.data.value.clients"
            :key="client.id"
            class="cursor-pointer"
            tabindex="0"
            @click="open(client)"
            @keydown.enter="open(client)"
          >
            <td>
              <div class="font-weight-medium">{{ client.name }}</div>
              <div v-if="client.description" class="text-body-small text-medium-emphasis">{{ client.description }}</div>
            </td>
            <td><ApiClientStatusChip :status="client.status" /></td>
            <td>{{ client.permissions.length }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <CreateApiClientDialog v-model="createOpen" :events="page.data.value.events" @created="open" />
  </div>
</template>
