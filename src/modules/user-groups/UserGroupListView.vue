<script setup lang="ts">
import { mdiDeleteOutline, mdiPencil, mdiPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import DataTable from "@/shared/components/DataTable.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import CreateUserGroupDialog from "./components/CreateUserGroupDialog.vue";
import UserGroupEditorDialog from "./components/UserGroupEditorDialog.vue";
import { describeUserGroupError } from "./user-group-problems";
import { deleteUserGroup, listUserGroups, type UserGroupDto } from "./user-groups.api";

/**
 * User groups with their editor in a dialog. The open group lives in the URL
 * (`/admin/user-groups/:userGroupId`), so links and the back button reopen it.
 */
const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();
const groups = useAsyncData(listUserGroups, [] as UserGroupDto[]);
const createOpen = ref(false);
const confirmDelete = ref<UserGroupDto | null>(null);
const canManage = computed(() => session.can("user-groups.manage"));

const openGroupId = computed(() => (route.params.userGroupId === undefined ? null : String(route.params.userGroupId)));
const editorOpen = computed({
  get: () => openGroupId.value !== null,
  set: (isOpen: boolean) => {
    if (!isOpen) {
      void router.push({ name: "user-groups" });
    }
  },
});

const headers = [
  { title: "Name", key: "name" },
  { title: "Members", key: "memberCount", align: "end" as const },
  { title: "Permissions", key: "permissions", value: (group: UserGroupDto) => group.permissions.length, align: "end" as const },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const },
];

function open(group: UserGroupDto): void {
  void router.push({ name: "user-group-detail", params: { userGroupId: group.id } });
}

async function remove(group: UserGroupDto): Promise<void> {
  confirmDelete.value = null;
  try {
    await deleteUserGroup(group.id);
    toast.success(`User group ${group.name} was deleted.`);
    await groups.load();
  } catch (caught: unknown) {
    toast.error(describeUserGroupError(caught));
  }
}

onMounted(groups.load);
</script>

<template>
  <ViewContent>
    <ViewHeader title="User groups" subtitle="Authorization groups. They are unrelated to tactical event groups such as Bravo.">
      <template #actions>
        <v-btn v-if="canManage" color="primary" :prepend-icon="mdiPlus" @click="createOpen = true">New user group</v-btn>
      </template>
    </ViewHeader>

    <v-skeleton-loader v-if="groups.state.value === 'loading'" type="table" />
    <v-alert v-else-if="groups.state.value === 'error'" type="error">{{ groups.error.value }}</v-alert>
    <EmptyState v-else-if="groups.data.value.length === 0" title="No user groups" />

    <v-card v-else>
      <DataTable
        :headers="headers"
        :items="groups.data.value"
        search-label="Search user groups"
        storage-key="user-groups"
        hover
        class="clickable-rows"
        @click:row="(_: unknown, { item }: { item: UserGroupDto }) => open(item)"
      >
        <template #[`item.name`]="{ item }">
          <router-link :to="{ name: 'user-group-detail', params: { userGroupId: item.id } }" class="row-link" @click.stop>
            <span class="font-weight-medium">{{ item.name }}</span>
            <v-chip v-if="item.system" size="x-small" class="ml-2">System</v-chip>
          </router-link>
        </template>
        <template #[`item.actions`]="{ item }">
          <span class="text-no-wrap">
            <v-btn
              v-tooltip:top="canManage ? 'Edit' : 'View'"
              :icon="mdiPencil"
              :aria-label="`Edit ${item.name}`"
              variant="text"
              size="small"
              @click.stop="open(item)"
            />
            <v-btn
              v-if="canManage && !item.system"
              v-tooltip:top="'Delete'"
              :icon="mdiDeleteOutline"
              :aria-label="`Delete ${item.name}`"
              color="error"
              variant="text"
              size="small"
              @click.stop="confirmDelete = item"
            />
          </span>
        </template>
      </DataTable>
    </v-card>

    <CreateUserGroupDialog v-model="createOpen" @created="(group: UserGroupDto) => { void groups.load(); open(group); }" />
    <UserGroupEditorDialog
      v-if="openGroupId"
      v-model="editorOpen"
      :user-group-id="openGroupId"
      @changed="groups.load"
      @deleted="groups.load"
    />
    <ConfirmDialog
      :model-value="confirmDelete !== null"
      title="Delete this user group?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="confirmDelete = null"
      @confirm="confirmDelete && remove(confirmDelete)"
    >
      All members lose the permissions of {{ confirmDelete?.name }} immediately.
    </ConfirmDialog>
  </ViewContent>
</template>
