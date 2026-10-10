<script setup lang="ts">
import { mdiAccountMultipleOutline, mdiAccountRemoveOutline } from "@mdi/js";
import { computed, nextTick, onMounted, ref } from "vue";
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
    .split(/s+/)
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
    <div v-else class="member-list">
      <div v-for="member in members.data.value" :key="member.id" class="member-row">
        <v-avatar color="primary" variant="tonal" size="36" class="text-body-medium">{{ initials(member.displayName) }}</v-avatar>
        <div class="member-row__text">
          <div class="text-body-large text-truncate">{{ member.displayName }}</div>
          <div class="text-body-small text-medium-emphasis text-truncate">{{ member.email ?? "No local login" }}</div>
        </div>
        <v-btn
          v-if="canManage"
          :icon="mdiAccountRemoveOutline"
          variant="text"
          size="small"
          :aria-label="`Remove ${member.displayName} from this group`"
          :title="`Remove ${member.displayName}`"
          @click="change(() => removeGroupMember(userGroupId, member.id), `${member.displayName} was removed from this group.`)"
        />
      </div>
      <div v-if="members.data.value.length === 0" class="member-row text-medium-emphasis">
        <v-icon :icon="mdiAccountMultipleOutline" />
        <span class="text-body-medium">No members yet.</span>
      </div>
    </div>

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

<style scoped>
.member-list {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px 10px 14px;
}
.member-row + .member-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.member-row__text {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
