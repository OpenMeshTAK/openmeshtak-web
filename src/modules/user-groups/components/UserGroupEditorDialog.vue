<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import { computed, ref, watch } from "vue";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { listAllEvents } from "@/modules/events/events.api";
import { describeUserGroupError } from "../user-group-problems";
import { deleteUserGroup, getUserGroup, updateUserGroup, type UserGroupDto } from "../user-groups.api";
import UserGroupMembersCard from "./UserGroupMembersCard.vue";

/** Edits one user group's name, permissions and members without leaving the group list. */
const props = defineProps<{ userGroupId: string }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ changed: []; deleted: [] }>();
const session = useSession();
const toast = useToast();
const canManage = computed(() => session.can("user-groups.manage"));

const name = ref("");
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const confirmDelete = ref(false);
const saving = useSubmission(describeUserGroupError);

function show(group: UserGroupDto): UserGroupDto {
  name.value = group.name;
  grants.value = structuredClone(group.permissions);
  return group;
}

const page = useAsyncData(async () => {
  const [group, events] = await Promise.all([getUserGroup(props.userGroupId), listAllEvents()]);
  return { group: show(group), events: events.map(({ id, name: eventName }) => ({ id, name: eventName })) };
}, null);

async function save(): Promise<void> {
  const current = page.data.value;
  if (current === null) {
    return;
  }
  const saved = await saving.run(async () => {
    current.group = show(
      await updateUserGroup(current.group.id, {
        version: current.group.version,
        name: name.value,
        slug: current.group.slug,
        permissions: grants.value,
      }),
    );
  });
  if (saved !== null) {
    toast.success("Saved. Members' access changed immediately.");
    emit("changed");
  } else {
    toast.error(saving.error.value);
  }
}

async function remove(): Promise<void> {
  confirmDelete.value = false;
  try {
    await deleteUserGroup(props.userGroupId);
    toast.success(`User group ${name.value} was deleted.`);
    open.value = false;
    emit("deleted");
  } catch (caught: unknown) {
    toast.error(describeUserGroupError(caught));
  }
}

watch(
  () => [open.value, props.userGroupId] as const,
  ([isOpen]) => {
    if (isOpen) {
      void page.load();
    }
  },
  { immediate: true },
);
</script>

<template>
  <v-dialog v-model="open" max-width="1200" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2 pt-4 px-6">
        <span class="text-wrap">{{ page.data.value?.group.name ?? "User group" }}</span>
        <v-chip v-if="page.data.value?.group.system" size="x-small" label>System</v-chip>
        <v-spacer />
        <v-btn :icon="mdiClose" variant="text" size="small" aria-label="Close" @click="open = false" />
      </v-card-title>

      <v-card-text class="px-6">
        <v-skeleton-loader v-if="page.state.value === 'loading'" type="article" />
        <v-alert v-else-if="page.state.value === 'error'" type="error">{{ page.error.value }}</v-alert>
        <v-row v-else-if="page.data.value">
          <v-col cols="12" lg="7">
            <div class="text-title-medium font-weight-medium mb-4">Permissions</div>
            <v-alert v-if="page.data.value.group.system" type="info" class="mb-4">
              The Admin group always holds every permission instance-wide. Only its name can change.
            </v-alert>
            <v-text-field v-model="name" label="Name" :disabled="!canManage" />
            <PermissionGrantEditor
              v-model="grants"
              :events="page.data.value.events"
              :disabled="!canManage || page.data.value.group.system"
            />
          </v-col>
          <v-col cols="12" lg="5">
            <UserGroupMembersCard :user-group-id="userGroupId" variant="outlined" @changed="emit('changed')" />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions v-if="canManage && page.data.value" class="px-6 pb-4">
        <v-btn v-if="!page.data.value.group.system" color="error" variant="text" @click="confirmDelete = true">
          Delete group…
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving.submitting.value" @click="save">Save changes</v-btn>
      </v-card-actions>
    </v-card>

    <ConfirmDialog v-model="confirmDelete" title="Delete this user group?" confirm-label="Delete" confirm-color="error" @confirm="remove">
      All members lose the permissions of {{ page.data.value?.group.name }} immediately.
    </ConfirmDialog>
  </v-dialog>
</template>
