<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
const toast = useToast();
const session = useSession();
const canManage = computed(() => session.can("user-groups.manage"));

const members = useAsyncData(() => listGroupMembers(props.userGroupId), [] as UserDto[]);
// Picking new members needs users.read; without it the card stays read-only.
const users = useAsyncData(() => (session.can("users.read") ? listAllUsers() : Promise.resolve([])), [] as UserDto[]);
const userToAdd = ref<string | null>(null);

const candidates = computed(() =>
  users.data.value.filter(({ id }) => !members.data.value.some((member) => member.id === id)),
);

async function change(action: () => Promise<void>, done: string): Promise<void> {
  try {
    await action();
    toast.success(done);
    await members.load();
  } catch (caught: unknown) {
    toast.error(describeUserGroupError(caught));
  }
}

function add(): void {
  const userId = userToAdd.value;
  if (userId !== null) {
    const user = users.data.value.find(({ id }) => id === userId);
    userToAdd.value = null;
    void change(() => addGroupMember(props.userGroupId, userId), `${user?.displayName ?? "The user"} was added to this group.`);
  }
}

onMounted(() => Promise.all([members.load(), users.load()]));
</script>

<template>
  <v-card class="pa-5">
    <div class="text-subtitle-1 font-weight-medium mb-4">Members</div>

    <v-skeleton-loader v-if="members.state.value === 'loading'" type="list-item-two-line@2" />
    <v-alert v-else-if="members.state.value === 'error'" type="error">{{ members.error.value }}</v-alert>
    <v-list v-else-if="members.data.value.length > 0" density="compact" class="mb-4">
      <v-list-item
        v-for="member in members.data.value"
        :key="member.id"
        :title="member.displayName"
        :subtitle="member.email ?? 'No local login'"
      >
        <template v-if="canManage" #append>
          <v-btn variant="text" size="small" color="error" @click="change(() => removeGroupMember(userGroupId, member.id), `${member.displayName} was removed from this group.`)">
            Remove
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
    <p v-else class="text-body-2 mb-4">No members yet.</p>

    <div v-if="canManage && users.data.value.length > 0" class="d-flex ga-2 align-center">
      <v-autocomplete
        v-model="userToAdd"
        :items="candidates"
        item-title="displayName"
        item-value="id"
        label="Add a user"
        variant="outlined"
        density="comfortable"
        hide-details
      />
      <v-btn color="primary" :disabled="userToAdd === null" @click="add">Add</v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mt-2 mb-0">
      You can only add members to groups whose permissions you hold yourself.
    </p>
  </v-card>
</template>
