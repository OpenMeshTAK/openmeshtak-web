<script setup lang="ts">
import { mdiAccountRemoveOutline } from "@mdi/js";
import { computed, nextTick, onMounted, ref } from "vue";
import DataTable from "@/shared/components/DataTable.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { describeUserGroupError } from "../user-group-problems";
import {
  addGroupMember,
  listAllUsers,
  listGroupMembers,
  removeGroupMember,
  type UserDto,
} from "../user-groups.api";

const props = defineProps<{ userGroupId: string }>();
const emit = defineEmits<{ changed: [] }>();
const toast = useToast();
const session = useSession();
const canManage = computed(() => session.can("user-group-members.manage"));

const members = useAsyncData(() => listGroupMembers(props.userGroupId), [] as UserDto[]);
// Picking new members needs users.read; without it the card stays read-only.
const users = useAsyncData(() => (session.can("users.read") ? listAllUsers() : Promise.resolve([])), [] as UserDto[]);
const userToAdd = ref<string | null>(null);

const candidates = computed(() =>
  users.data.value.filter(({ id }) => !members.data.value.some((member) => member.id === id)),
);

const headers = computed(() => [
  { title: "Name", key: "displayName" },
  { title: "Email", key: "email", value: (member: UserDto) => member.email ?? "No local login" },
  ...(canManage.value ? [{ title: "Actions", key: "actions", sortable: false, align: "end" as const }] : []),
]);

async function change(action: () => Promise<void>, done: string): Promise<void> {
  try {
    await action();
    toast.success(done);
    emit("changed");
    await members.load();
  } catch (caught: unknown) {
    toast.error(describeUserGroupError(caught));
  }
}

/** Picking a user adds them right away; the field clears for the next one. */
function add(userId: string | null): void {
  if (userId !== null) {
    const user = users.data.value.find(({ id }) => id === userId);
    void nextTick(() => (userToAdd.value = null));
    void change(() => addGroupMember(props.userGroupId, userId), `${user?.displayName ?? "The user"} was added to this group.`);
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

onMounted(() => Promise.all([members.load(), users.load()]));
</script>

<template>
  <div>
    <div class="d-flex align-center ga-2 mb-1">
      <div class="text-title-small flex-grow-1">Members</div>
      <span v-if="members.state.value === 'ready'" class="text-body-small text-medium-emphasis">
        {{ members.data.value.length }} {{ members.data.value.length === 1 ? "member" : "members" }}
      </span>
    </div>
    <p class="text-body-small text-medium-emphasis mt-0 mb-3">Changes here apply immediately.</p>

    <v-skeleton-loader v-if="members.state.value === 'loading'" type="list-item-avatar-two-line@2" />
    <v-alert v-else-if="members.state.value === 'error'" type="error">{{ members.error.value }}</v-alert>
    <v-card v-else variant="outlined">
      <DataTable
        :headers="headers"
        :items="members.data.value"
        search-label="Search members"
        storage-key="user-group-members"
        no-data-text="No members yet."
        :sort-by="[{ key: 'displayName', order: 'asc' }]"
      >
        <template #[`item.displayName`]="{ item }">
          <div class="d-flex align-center ga-3 py-1">
            <v-avatar color="primary" variant="tonal" size="32" class="text-body-small">{{ initials(item.displayName) }}</v-avatar>
            <span class="text-truncate">{{ item.displayName }}</span>
          </div>
        </template>
        <template #[`item.email`]="{ item }"><span class="text-medium-emphasis">{{ item.email ?? "No local login" }}</span></template>
        <template #[`item.actions`]="{ item }">
          <v-btn
            :icon="mdiAccountRemoveOutline"
            variant="text"
            size="small"
            :aria-label="`Remove ${item.displayName} from this group`"
            :title="`Remove ${item.displayName}`"
            @click="change(() => removeGroupMember(userGroupId, item.id), `${item.displayName} was removed from this group.`)"
          />
        </template>
      </DataTable>
    </v-card>

    <template v-if="canManage && users.data.value.length > 0">
      <v-autocomplete
        v-model="userToAdd"
        :items="candidates"
        item-title="displayName"
        item-value="id"
        label="Add a user"
        density="comfortable"
        class="mt-3"
        hint="You can only add members to groups whose permissions you hold yourself."
        persistent-hint
        @update:model-value="add"
      />
    </template>
  </div>
</template>
