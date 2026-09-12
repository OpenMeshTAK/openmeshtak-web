<script setup lang="ts">
import { mdiPlus } from "@mdi/js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSession } from "@/modules/auth/session";
import CreateUserGroupDialog from "./components/CreateUserGroupDialog.vue";
import { listUserGroups, type UserGroupDto } from "./user-groups.api";

const router = useRouter();
const session = useSession();
const groups = useAsyncData(listUserGroups, [] as UserGroupDto[]);
const createOpen = ref(false);

function open(group: UserGroupDto): void {
  void router.push({ name: "user-group-detail", params: { userGroupId: group.id } });
}

onMounted(groups.load);
</script>

<template>
  <ViewContent>
    <ViewHeader title="User groups" subtitle="Authorization groups. They are unrelated to tactical event groups such as Bravo.">
      <template #actions>
        <v-btn v-if="session.can('user-groups.manage')" color="primary" :prepend-icon="mdiPlus" @click="createOpen = true">
          New user group
        </v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="groups.state.value === 'loading'" type="table" />
    <v-alert v-else-if="groups.state.value === 'error'" type="error">{{ groups.error.value }}</v-alert>
    <EmptyState v-else-if="groups.data.value.length === 0" title="No user groups" />

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
            v-for="group in groups.data.value"
            :key="group.id"
            class="cursor-pointer"
            tabindex="0"
            @click="open(group)"
            @keydown.enter="open(group)"
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

    <CreateUserGroupDialog v-model="createOpen" @created="open" />
  </ViewContent>
</template>
