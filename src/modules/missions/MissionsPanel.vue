<script setup lang="ts">
import { mdiMapPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { createMission, deleteMission, listMissions, type MissionDto } from "./missions.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const router = useRouter();
const session = useSession();
const toast = useToast();

const missions = useAsyncData(() => listMissions(props.event.id), [] as MissionDto[]);
const canEdit = computed(() => props.event.status !== "archived" && session.can("missions.edit", props.event.id));

const createOpen = ref(false);
const name = ref("");
const creation = useSubmission();
const removing = ref<MissionDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function openEditor(mission: MissionDto): void {
  void router.push({ name: "mission-editor", params: { eventId: props.event.id, missionId: mission.id } });
}

async function create(): Promise<void> {
  const created = await creation.run(() => createMission(props.event.id, { name: name.value }));
  if (created !== null) {
    createOpen.value = false;
    toast.success(`Mission ${created.value.name} was created.`);
    openEditor(created.value);
  }
}

async function confirmRemove(): Promise<void> {
  const mission = removing.value;
  removing.value = null;
  if (mission === null) {
    return;
  }
  try {
    await deleteMission({ eventId: props.event.id, missionId: mission.id });
    toast.success(`Mission ${mission.name} was deleted.`);
    await missions.load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(missions.load);
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4 ga-4 flex-wrap">
      <p class="text-body-2 text-medium-emphasis flex-grow-1 mb-0">
        Missions hold the event's map content: markers, lines and areas in layers. Participants
        receive published revisions, never the draft.
      </p>
      <v-btn v-if="canEdit" color="primary" :prepend-icon="mdiMapPlus" @click="(name = ''), creation.reset(), (createOpen = true)">
        New mission
      </v-btn>
    </div>

    <v-skeleton-loader v-if="missions.state.value === 'loading'" type="table" />
    <ErrorState v-else-if="missions.state.value === 'error'" :message="missions.error.value" @retry="missions.load" />
    <EmptyState v-else-if="missions.data.value.length === 0" title="No missions yet" text="Create a mission to draw the event's map content." />

    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Published</th>
            <th class="d-none d-md-table-cell">Last change</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mission in missions.data.value" :key="mission.id" style="cursor: pointer" @click="openEditor(mission)">
            <td class="font-weight-medium">{{ mission.name }}</td>
            <td>
              <span v-if="mission.latestRevision">Revision {{ mission.latestRevision }}</span>
              <v-chip v-else size="small" variant="tonal" label>Draft only</v-chip>
            </td>
            <td class="d-none d-md-table-cell">{{ dateFormat.format(new Date(mission.updatedAt)) }}</td>
            <td class="text-right text-no-wrap">
              <v-btn variant="text" size="small" @click.stop="openEditor(mission)">{{ canEdit ? "Edit" : "View" }}</v-btn>
              <v-btn v-if="canEdit" variant="text" size="small" color="error" @click.stop="removing = mission">Delete</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="createOpen" max-width="480">
      <v-card class="pa-2">
        <v-card-title>New mission</v-card-title>
        <v-card-text>
          <v-alert v-if="creation.error.value" type="error" class="mb-4">{{ creation.error.value }}</v-alert>
          <v-text-field
            v-model="name"
            label="Name"
            maxlength="100"
            autofocus
            :error-messages="messagesFor(creation.fields.value, 'name')"
            @keydown.enter="create"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="creation.submitting.value" :disabled="name.trim() === ''" @click="create">
            Create and open
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      :model-value="removing !== null"
      title="Delete this mission?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="removing = null"
      @confirm="confirmRemove"
    >
      {{ removing?.name }} is deleted with its draft and all published revisions.
    </ConfirmDialog>
  </div>
</template>
