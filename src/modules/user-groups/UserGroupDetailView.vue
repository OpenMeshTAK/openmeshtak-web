<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { useSession } from "@/modules/auth/session";
import { listAllEvents } from "@/modules/events/events.api";
import UserGroupMembersCard from "./components/UserGroupMembersCard.vue";
import { useToast } from "@/shared/feedback/toast";
import { describeUserGroupError } from "./user-group-problems";
import { deleteUserGroup, getUserGroup, updateUserGroup, type UserGroupDto } from "./user-groups.api";

const route = useRoute();
const router = useRouter();
const session = useSession();
const userGroupId = computed(() => String(route.params.userGroupId));
const canManage = computed(() => session.can("user-groups.manage"));

const name = ref("");
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const toast = useToast();
const confirmDelete = ref(false);
const saving = useSubmission(describeUserGroupError);

function show(group: UserGroupDto): UserGroupDto {
  name.value = group.name;
  grants.value = structuredClone(group.permissions);
  return group;
}

const page = useAsyncData(async () => {
  const [group, events] = await Promise.all([getUserGroup(userGroupId.value), listAllEvents()]);
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
  } else {
    toast.error(saving.error.value);
  }
}

async function remove(): Promise<void> {
  confirmDelete.value = false;
  try {
    await deleteUserGroup(userGroupId.value);
    toast.success(`User group ${name.value} was deleted.`);
    await router.push({ name: "user-groups" });
  } catch (caught: unknown) {
    toast.error(describeUserGroupError(caught));
  }
}

onMounted(page.load);
</script>

<template>
  <ViewContent :state="page.state.value" :error="page.error.value" @retry="page.load">
    <template v-if="page.data.value">
      <ViewHeader
        :title="page.data.value.group.name"
        :subtitle="page.data.value.group.system ? 'Protected system group' : 'User group'"
      >
        <template #actions>
          <v-btn v-if="canManage && !page.data.value.group.system" color="error" variant="outlined" @click="confirmDelete = true">
            Delete group…
          </v-btn>
        </template>
      </ViewHeader>


      <v-row>
        <v-col cols="12" lg="7">
          <v-card class="pa-5">
            <div class="text-subtitle-1 font-weight-medium mb-4">Permissions</div>
            <v-alert v-if="page.data.value.group.system" type="info" class="mb-4">
              The Admin group always holds every permission instance-wide. Only its name can change.
            </v-alert>
            <v-text-field v-model="name" label="Name" :disabled="!canManage" />
            <PermissionGrantEditor
              v-model="grants"
              :events="page.data.value.events"
              :disabled="!canManage || page.data.value.group.system"
            />
            <v-btn v-if="canManage" color="primary" class="mt-4" :loading="saving.submitting.value" @click="save">
              Save changes
            </v-btn>
          </v-card>
        </v-col>
        <v-col cols="12" lg="5">
          <UserGroupMembersCard :user-group-id="userGroupId" />
        </v-col>
      </v-row>

      <ConfirmDialog v-model="confirmDelete" title="Delete this user group?" confirm-label="Delete" confirm-color="error" @confirm="remove">
        All members lose the permissions of {{ page.data.value.group.name }} immediately.
      </ConfirmDialog>
    </template>
  </ViewContent>
</template>
