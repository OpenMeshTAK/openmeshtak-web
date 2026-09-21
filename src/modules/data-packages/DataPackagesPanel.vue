<script setup lang="ts">
import { mdiAccountGroup, mdiClockOutline, mdiDelete, mdiDotsVertical, mdiExport, mdiMapOutline, mdiMapPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import {
  audienceMembers,
  audienceNames,
  loadAudienceOptions,
  type AudienceOptions,
} from "@/modules/event-audience/audience-options";
import CombinedExportDialog from "./components/CombinedExportDialog.vue";
import PackageAudienceDialog from "./components/PackageAudienceDialog.vue";
import { createDataPackage, deleteDataPackage, listDataPackages, type DataPackageDto } from "./data-packages.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const router = useRouter();
const session = useSession();
const toast = useToast();

const dataPackages = useAsyncData(() => listDataPackages(props.event.id), [] as DataPackageDto[]);
const audienceOptions = ref<AudienceOptions>({ groups: [], roles: [], members: null });
const audienceTarget = ref<DataPackageDto | null>(null);
const audienceOpen = ref(false);
const exportOpen = ref(false);
const canPublish = computed(
  () => props.event.status !== "archived" && session.can("data-packages.publish", props.event.id),
);
const canEdit = computed(() => props.event.status !== "archived" && session.can("data-packages.edit", props.event.id));

const createOpen = ref(false);
const name = ref("");
const creation = useSubmission();
const removing = ref<DataPackageDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function openEditor(dataPackage: DataPackageDto): void {
  void router.push({ name: "package-editor", params: { eventId: props.event.id, packageId: dataPackage.id } });
}

function openEventEditor(): void {
  void router.push({ name: "event-editor", params: { eventId: props.event.id } });
}

async function create(): Promise<void> {
  const created = await creation.run(() => createDataPackage(props.event.id, { name: name.value }));
  if (created !== null) {
    createOpen.value = false;
    toast.success(`Data package ${created.value.name} was created.`);
    openEditor(created.value);
  }
}

async function confirmRemove(): Promise<void> {
  const dataPackage = removing.value;
  removing.value = null;
  if (dataPackage === null) {
    return;
  }
  try {
    await deleteDataPackage({ eventId: props.event.id, packageId: dataPackage.id });
    toast.success(`Data package ${dataPackage.name} was deleted.`);
    await dataPackages.load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

function audienceSummary(dataPackage: DataPackageDto): string {
  const { audience } = dataPackage;
  const members = audienceOptions.value.members;
  if (audience.allMembers) {
    return members === null ? "Every member" : `Every member · ${String(members.length)}`;
  }
  const names = audienceNames(audience, audienceOptions.value);
  const label = names.length === 0 ? "Nobody selected yet" : names.join(", ");
  return members === null ? label : `${label} · ${String(audienceMembers(audience, members).length)} members`;
}

function editAudience(dataPackage: DataPackageDto): void {
  audienceTarget.value = dataPackage;
  audienceOpen.value = true;
}

async function audienceSaved(saved: DataPackageDto): Promise<void> {
  toast.success(`${saved.name} now reaches its new audience.`);
  await dataPackages.load();
}

function copiedPackage(created: DataPackageDto): void {
  toast.success(`Editable data package ${created.name} was created.`);
  openEditor(created);
}

async function loadOptions(): Promise<void> {
  try {
    audienceOptions.value = await loadAudienceOptions(props.event.id, session.can("members.read", props.event.id));
  } catch {
    // The list still works without names; summaries then fall back to "Unknown".
  }
}

onMounted(() => {
  void dataPackages.load();
  void loadOptions();
});
</script>

<template>
  <div>
    <SectionHeader
      title="Data packages"
      description="Map content in layers. Members receive the newest published revision of the packages whose audience includes them, never the draft."
    >
      <template #actions>
        <v-btn
          v-if="dataPackages.data.value.length > 0"
          variant="tonal"
          :prepend-icon="mdiMapOutline"
          @click="openEventEditor"
        >
          Open all data packages
        </v-btn>
        <v-btn
          v-if="dataPackages.data.value.some(({ latestRevision }) => latestRevision !== null)"
          variant="tonal"
          :prepend-icon="mdiExport"
          @click="exportOpen = true"
        >
          Export
        </v-btn>
        <v-btn v-if="canEdit" color="primary" :prepend-icon="mdiMapPlus" @click="(name = ''), creation.reset(), (createOpen = true)">
          New data package
        </v-btn>
      </template>
    </SectionHeader>

    <v-skeleton-loader v-if="dataPackages.state.value === 'loading'" type="list-item-avatar-two-line@3" />
    <ErrorState v-else-if="dataPackages.state.value === 'error'" :message="dataPackages.error.value" @retry="dataPackages.load" />
    <EmptyState v-else-if="dataPackages.data.value.length === 0" title="No data packages yet" text="Create a data package to draw the event's map content." />

    <v-card v-else>
      <template v-for="(dataPackage, index) in dataPackages.data.value" :key="dataPackage.id">
        <v-divider v-if="index > 0" />
        <div class="package-row d-flex align-start ga-4 pa-4">
          <v-avatar color="primary" variant="tonal" size="40" rounded="lg" class="flex-shrink-0">
            <v-icon :icon="mdiMapOutline" />
          </v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="d-flex align-center flex-wrap ga-2 mb-1">
              <span class="text-subtitle-1 font-weight-medium text-break">{{ dataPackage.name }}</span>
              <v-chip v-if="dataPackage.latestRevision" size="small" color="success" variant="tonal" label>
                Revision {{ dataPackage.latestRevision }} published
              </v-chip>
              <v-chip v-else size="small" variant="tonal" label>Draft only</v-chip>
            </div>
            <div class="facts text-body-2">
              <span class="fact">
                <v-icon :icon="mdiAccountGroup" size="16" />
                <span class="text-truncate">{{ audienceSummary(dataPackage) }}</span>
              </span>
              <span class="fact text-medium-emphasis">
                <v-icon :icon="mdiClockOutline" size="16" />
                Changed {{ dateFormat.format(new Date(dataPackage.updatedAt)) }}
              </span>
            </div>
          </div>
          <div class="d-flex align-center ga-1 flex-shrink-0">
            <v-btn variant="tonal" size="small" @click="openEditor(dataPackage)">{{ canEdit ? "Open editor" : "View" }}</v-btn>
            <v-menu v-if="canPublish || canEdit" location="bottom end">
              <template #activator="{ props: activator }">
                <v-btn v-bind="activator" :icon="mdiDotsVertical" variant="text" size="small" :aria-label="`More actions for ${dataPackage.name}`" />
              </template>
              <v-list density="compact" min-width="220">
                <v-list-item v-if="canPublish" :prepend-icon="mdiAccountGroup" title="Who receives it" @click="editAudience(dataPackage)" />
                <template v-if="canEdit">
                  <v-divider v-if="canPublish" class="my-1" />
                  <v-list-item :prepend-icon="mdiDelete" title="Delete data package" base-color="error" @click="removing = dataPackage" />
                </template>
              </v-list>
            </v-menu>
          </div>
        </div>
      </template>
    </v-card>

    <CombinedExportDialog
      v-model="exportOpen"
      :event-id="event.id"
      :event-name="event.name"
      :packages="dataPackages.data.value"
      :can-create-draft="canEdit"
      @created="copiedPackage"
    />
    <PackageAudienceDialog
      v-if="audienceTarget"
      v-model="audienceOpen"
      :event-id="event.id"
      :data-package="audienceTarget"
      :options="audienceOptions"
      @saved="audienceSaved"
    />

    <v-dialog v-model="createOpen" max-width="480">
      <v-card class="pa-2">
        <v-card-title>New data package</v-card-title>
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
      title="Delete this data package?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="removing = null"
      @confirm="confirmRemove"
    >
      {{ removing?.name }} is deleted with its draft and all published revisions.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
}
.fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}
</style>
