<script setup lang="ts">
import { mdiAccountGroup, mdiDelete, mdiMapOutline, mdiMapPlus, mdiSync } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import DataTable from "@/shared/components/DataTable.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import {
  createDataPackage,
  deleteDataPackage,
  listDataPackages,
  publishDataPackage,
  type DataPackageDto,
} from "@/modules/data-packages/data-packages.api";
import { topFirst } from "@/modules/data-packages/package-order";
import { audienceNames, loadAudienceOptions, type AudienceOptions } from "@/modules/event-audience/audience-options";
import type { EventDto } from "@/modules/events/events.api";
import MissionAccessDialog from "./MissionAccessDialog.vue";

/**
 * Missions are drawn with the Data Package editor. TAK apps subscribe to them and receive each
 * synced revision; members chosen as writers change them from their TAK app.
 */
const props = defineProps<{ event: EventDto }>();
const router = useRouter();
const session = useSession();
const toast = useToast();

const missions = useAsyncData(() => listDataPackages(props.event.id, "mission"), [] as DataPackageDto[]);
const ordered = computed(() => topFirst(missions.data.value));
const options = ref<AudienceOptions>({ groups: [], roles: [], members: null });
const accessTarget = ref<DataPackageDto | null>(null);
const accessOpen = ref(false);
const syncingId = ref<string | null>(null);
const createOpen = ref(false);
const name = ref("");
const creation = useSubmission();
const removing = ref<DataPackageDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

const canEdit = computed(() => props.event.status !== "archived" && session.can("missions.edit", props.event.id));
const canSync = computed(() => props.event.status !== "archived" && session.can("missions.publish", props.event.id));

const headers = [
  { title: "Mission", key: "name" },
  { title: "Who sees it", key: "audience", value: (mission: DataPackageDto) => whoSees(mission) },
  { title: "Who changes it", key: "writers", value: (mission: DataPackageDto) => whoWrites(mission) },
  { title: "Updated", key: "updatedAt", searchable: false },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const },
];

function openEditor(): void {
  void router.push({ name: "mission-editor", params: { eventId: props.event.id } });
}

function whoSees(mission: DataPackageDto): string {
  if (mission.audience.allMembers) {
    return "Every member";
  }
  const names = audienceNames(mission.audience, options.value);
  return names.length === 0 ? "Nobody yet" : names.join(", ");
}

function whoWrites(mission: DataPackageDto): string {
  const names = audienceNames(mission.writers, options.value);
  return names.length === 0 ? "Only the editor" : names.join(", ");
}

async function sync(mission: DataPackageDto): Promise<void> {
  syncingId.value = mission.id;
  try {
    const result = await publishDataPackage({ eventId: props.event.id, packageId: mission.id });
    toast.success(`Synced ${mission.name} revision ${String(result.revision.number)}.`);
    await missions.load();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    syncingId.value = null;
  }
}

async function create(): Promise<void> {
  const created = await creation.run(() => createDataPackage(props.event.id, { name: name.value.trim(), kind: "mission" }));
  if (created !== null) {
    createOpen.value = false;
    toast.success(`Mission ${created.value.name} was created.`);
    await missions.load();
  }
}

async function confirmRemove(): Promise<void> {
  const mission = removing.value;
  if (mission === null) {
    return;
  }
  try {
    await deleteDataPackage({ eventId: props.event.id, packageId: mission.id });
    removing.value = null;
    toast.success(`Mission ${mission.name} was deleted.`);
    await missions.load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

function editAccess(mission: DataPackageDto): void {
  accessTarget.value = mission;
  accessOpen.value = true;
}

onMounted(async () => {
  await missions.load();
  try {
    options.value = await loadAudienceOptions(props.event.id, session.can("members.read", props.event.id));
  } catch (caught: unknown) {
    toast.error(caught);
  }
});
</script>

<template>
  <div>
    <SectionHeader
      title="Missions"
      description="Plan together with TAK apps: subscribers receive every synced revision, and chosen members change the mission from their app."
    >
      <template #actions>
        <v-btn v-if="missions.data.value.length > 0" variant="tonal" :prepend-icon="mdiMapOutline" @click="openEditor">Open editor</v-btn>
        <v-btn v-if="canEdit" color="primary" :prepend-icon="mdiMapPlus" @click="(name = ''), creation.reset(), (createOpen = true)">
          New mission
        </v-btn>
      </template>
    </SectionHeader>

    <v-skeleton-loader v-if="missions.state.value === 'loading'" type="list-item-avatar-two-line@3" />
    <ErrorState v-else-if="missions.state.value === 'error'" :message="missions.error.value" @retry="missions.load" />
    <EmptyState v-else-if="missions.data.value.length === 0" title="No missions yet" text="Create a mission to plan together with the TAK apps that subscribe to it." />

    <v-card v-else>
      <DataTable :headers="headers" :items="ordered" search-label="Search missions" storage-key="missions">
        <template #[`item.name`]="{ item }">
          <div class="d-flex align-center flex-wrap ga-2 py-2">
            <span class="font-weight-medium text-break">{{ item.name }}</span>
            <v-chip v-if="item.latestRevision" size="small" color="success" variant="tonal" label>Rev. {{ item.latestRevision }}</v-chip>
            <v-chip v-else size="small" variant="tonal" label>Not synced</v-chip>
            <v-chip
              v-if="item.latestRevision && item.hasUnpublishedChanges"
              size="small"
              color="warning"
              variant="tonal"
              label
              title="The editor has changes that subscribed TAK apps have not received yet"
            >
              Unsynced
            </v-chip>
          </div>
        </template>
        <template #[`item.updatedAt`]="{ item }">
          <span class="text-medium-emphasis text-no-wrap">{{ dateFormat.format(new Date(item.updatedAt)) }}</span>
        </template>
        <template #[`item.actions`]="{ item }">
          <span class="text-no-wrap">
            <v-btn
              v-if="canSync"
              color="primary"
              variant="tonal"
              size="small"
              :prepend-icon="mdiSync"
              :loading="syncingId === item.id"
              :disabled="!item.hasUnpublishedChanges"
              class="mr-1"
              @click="sync(item)"
            >
              Sync
            </v-btn>
            <v-btn v-if="canSync" variant="tonal" size="small" :prepend-icon="mdiAccountGroup" class="mr-1" @click="editAccess(item)">Access</v-btn>
            <v-btn variant="tonal" size="small" @click="openEditor">{{ canEdit ? "Open editor" : "View" }}</v-btn>
            <v-btn
              v-if="canEdit"
              :icon="mdiDelete"
              variant="text"
              size="small"
              color="error"
              :aria-label="`Delete ${item.name}`"
              @click="removing = item"
            />
          </span>
        </template>
      </DataTable>
    </v-card>

    <MissionAccessDialog
      v-if="accessTarget"
      v-model="accessOpen"
      :event-id="event.id"
      :mission="accessTarget"
      :options="options"
      @saved="missions.load"
    />

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
          <v-btn color="primary" :loading="creation.submitting.value" :disabled="name.trim() === ''" @click="create">Create</v-btn>
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
      The mission {{ removing?.name }} is deleted with its layers, items and synced revisions. TAK apps no longer receive it.
    </ConfirmDialog>
  </div>
</template>
