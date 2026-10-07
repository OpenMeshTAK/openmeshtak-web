<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import { computed, ref, watch } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { describeUserGroupError } from "@/modules/user-groups/user-group-problems";
import { addGroupMember, listUserGroups, removeGroupMember, type UserGroupDto } from "@/modules/user-groups/user-groups.api";
import { getUser, type UserDto } from "./users.api";

/** Adds one user to user groups or removes them, straight from the user list. */
const props = defineProps<{ user: UserDto }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ changed: [user: UserDto] }>();
const toast = useToast();

const current = ref<UserDto>(props.user);
const groups = ref<UserGroupDto[]>([]);
const groupToAdd = ref<string | null>(null);
const loadError = ref<string | null>(null);
const busy = ref(false);

const candidates = computed(() =>
  groups.value.filter(({ id }) => !current.value.userGroups.some((group) => group.id === id)),
);

async function loadGroups(): Promise<void> {
  loadError.value = null;
  try {
    groups.value = await listUserGroups();
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
  }
}

async function change(action: () => Promise<void>, done: string): Promise<void> {
  busy.value = true;
  try {
    await action();
    current.value = await getUser(current.value.id);
    emit("changed", current.value);
    toast.success(done);
  } catch (caught: unknown) {
    toast.error(describeUserGroupError(caught));
  } finally {
    busy.value = false;
  }
}

function add(): void {
  const group = groups.value.find(({ id }) => id === groupToAdd.value);
  if (group !== undefined) {
    groupToAdd.value = null;
    void change(() => addGroupMember(group.id, current.value.id), `${current.value.displayName} was added to ${group.name}.`);
  }
}

function remove(group: { id: string; name: string }): void {
  void change(() => removeGroupMember(group.id, current.value.id), `${current.value.displayName} was removed from ${group.name}.`);
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      current.value = props.user;
      groupToAdd.value = null;
      void loadGroups();
    }
  },
  { immediate: true },
);
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">User groups of {{ current.displayName }}</v-card-title>
      <v-card-text>
        <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
          Permissions come from user groups and change right away. You can only add someone to groups whose
          permissions you hold yourself.
        </p>
        <v-alert v-if="loadError" type="error" density="compact" class="mb-4">{{ loadError }}</v-alert>

        <div v-if="current.userGroups.length > 0" class="d-flex flex-wrap ga-2 mb-4">
          <v-chip v-for="group in current.userGroups" :key="group.id" :disabled="busy">
            {{ group.name }}
            <template #append>
              <v-btn
                :icon="mdiClose"
                :aria-label="`Remove from ${group.name}`"
                variant="text"
                size="x-small"
                density="comfortable"
                class="ml-1"
                @click="remove(group)"
              />
            </template>
          </v-chip>
        </div>
        <p v-else class="text-body-medium mt-0 mb-4">Not in any user group yet.</p>

        <div class="d-flex ga-2 align-center">
          <v-autocomplete
            v-model="groupToAdd"
            :items="candidates"
            item-title="name"
            item-value="id"
            label="Add to group"
            no-data-text="No more groups"
            hide-details
          />
          <v-btn color="primary" :disabled="groupToAdd === null" :loading="busy" @click="add">Add</v-btn>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
