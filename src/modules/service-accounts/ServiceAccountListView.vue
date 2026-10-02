<script setup lang="ts">
import { mdiPlus, mdiRobotOutline } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { listAllEvents } from "@/modules/events/events.api";
import CreateServiceAccountDialog from "./components/CreateServiceAccountDialog.vue";
import ServiceAccountStatusChip from "./components/ServiceAccountStatusChip.vue";
import { listServiceAccounts, type ServiceAccountDto } from "./service-accounts.api";

const router = useRouter();
const page = useAsyncData(
  async () => {
    const [accounts, events] = await Promise.all([listServiceAccounts(), listAllEvents()]);
    return { accounts, events: events.map(({ id, name }) => ({ id, name })) };
  },
  { accounts: [] as ServiceAccountDto[], events: [] as { id: string; name: string }[] },
);
const createOpen = ref(false);

function open(account: ServiceAccountDto): void {
  void router.push({ name: "service-account-detail", params: { serviceAccountId: account.id } });
}

onMounted(page.load);
</script>

<template>
  <div>
    <ViewHeader title="Service accounts" subtitle="Machine identities with their own API keys, for bots and portals. They never act as a user.">
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="createOpen = true">New service account</v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="page.state.value === 'loading'" type="table" />
    <v-alert v-else-if="page.state.value === 'error'" type="error">{{ page.error.value }}</v-alert>
    <EmptyState
      v-else-if="page.data.value.accounts.length === 0"
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
            v-for="account in page.data.value.accounts"
            :key="account.id"
            class="cursor-pointer"
            tabindex="0"
            @click="open(account)"
            @keydown.enter="open(account)"
          >
            <td>
              <div class="font-weight-medium">{{ account.name }}</div>
              <div v-if="account.description" class="text-caption text-medium-emphasis">{{ account.description }}</div>
            </td>
            <td><ServiceAccountStatusChip :status="account.status" /></td>
            <td>{{ account.permissions.length }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <CreateServiceAccountDialog v-model="createOpen" :events="page.data.value.events" @created="open" />
  </div>
</template>
