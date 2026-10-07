<script setup lang="ts">
import {
  mdiAccountGroup,
  mdiCellphoneArrowDown,
  mdiCircleOutline,
  mdiClockOutline,
  mdiDelete,
  mdiDragVertical,
  mdiExport,
  mdiFileImport,
  mdiImageArea,
  mdiMap,
  mdiMapMarker,
  mdiMapOutline,
  mdiMapPlus,
  mdiPackageVariantClosed,
  mdiPublish,
  mdiShapePolygonPlus,
  mdiVectorPolyline,
} from "@mdi/js";
import { computed, onMounted, ref, watch } from "vue";
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
import { VueDraggable } from "vue-draggable-plus";
import { topFirst } from "./package-order";
import ImportReportDialog from "@/modules/editor/components/ImportReportDialog.vue";
import PackageAudienceDialog from "./components/PackageAudienceDialog.vue";
import {
  createDataPackage,
  deleteDataPackage,
  importAsNewPackage,
  listDataPackages,
  publishDataPackage,
  reorderDataPackages,
  type DataPackageDto,
  type ImportReport,
} from "./data-packages.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const router = useRouter();
const session = useSession();
const toast = useToast();

const dataPackages = useAsyncData(() => listDataPackages(props.event.id), [] as DataPackageDto[]);
const audienceOptions = ref<AudienceOptions>({ groups: [], roles: [], members: null });
const audienceTarget = ref<DataPackageDto | null>(null);
const audienceOpen = ref(false);
const exportOpen = ref(false);
/** Top first: the first package is drawn above the others on the map. */
const orderedPackages = computed(() => topFirst(dataPackages.data.value));

/** Local copy for vue-draggable-plus, which reorders it during a drag; saved on drop. */
const rows = ref<DataPackageDto[]>([]);
watch(orderedPackages, (ordered) => {
  rows.value = [...ordered];
}, { immediate: true });

async function packagesDropped(): Promise<void> {
  const topFirstIds = rows.value.map(({ id }) => id);
  if (topFirstIds.every((id, index) => id === orderedPackages.value[index]?.id)) {
    return;
  }
  const bottomFirst = [...topFirstIds].reverse();
  dataPackages.data.value = dataPackages.data.value.map((dataPackage) => ({
    ...dataPackage,
    sortOrder: bottomFirst.indexOf(dataPackage.id),
  }));
  try {
    await reorderDataPackages(props.event.id, bottomFirst);
  } catch (caught: unknown) {
    toast.error(caught);
    await dataPackages.load();
  }
}
const fileInput = ref<HTMLInputElement | null>(null);
const importing = ref(false);
const importReport = ref<ImportReport | null>(null);
const reportOpen = ref(false);

async function importFile(changeEvent: Event): Promise<void> {
  const input = changeEvent.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file === undefined) {
    return;
  }
  importing.value = true;
  try {
    const imported = await importAsNewPackage(props.event.id, file);
    importReport.value = imported.report;
    reportOpen.value = true;
    toast.success(`Data package ${imported.dataPackage.name} was imported as a draft.`);
    await dataPackages.load();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    importing.value = false;
  }
}
const canPublish = computed(
  () => props.event.status !== "archived" && session.can("data-packages.publish", props.event.id),
);
const canEdit = computed(() => props.event.status !== "archived" && session.can("data-packages.edit", props.event.id));

const createOpen = ref(false);
const name = ref("");
const creation = useSubmission();
const removing = ref<DataPackageDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
const sizeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${sizeFormat.format(bytes / 1024)} KB`;
  }
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

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

function audienceLabel({ audience }: DataPackageDto): string {
  const names = audienceNames(audience, audienceOptions.value);
  return audience.allMembers ? "Everyone" : names.length === 0 ? "Nobody" : names.join(", ");
}

/** "reached/total", or null while member names are not readable. */
function audienceReach({ audience }: DataPackageDto): string | null {
  const members = audienceOptions.value.members;
  if (members === null) {
    return null;
  }
  const reached = audience.allMembers ? members.length : audienceMembers(audience, members).length;
  return `${String(reached)}/${String(members.length)}`;
}

function audienceTitle(dataPackage: DataPackageDto): string {
  const reach = audienceReach(dataPackage);
  const who = dataPackage.audience.allMembers ? "Every member" : audienceLabel(dataPackage);
  return reach === null ? `Receives it: ${who}` : `Receives it: ${who} (${reach} members)`;
}

/** Short label for the row plus the full sentence for its tooltip. */
function takDeliverySummary({ takDelivery }: DataPackageDto): { label: string; title: string } {
  if (takDelivery.onEnrollment && takDelivery.onConnection) {
    return { label: "Auto: enroll + updates", title: "Installs on TAK enrollment and with each new revision" };
  }
  if (takDelivery.onEnrollment) {
    return { label: "Auto: enroll", title: "Installs when a TAK app enrolls" };
  }
  if (takDelivery.onConnection) {
    return { label: "Auto: updates", title: "Installs each new revision on TAK connection" };
  }
  return { label: "Manual", title: "TAK apps install it manually" };
}

type ContentKind = keyof DataPackageDto["draftContents"];

const CONTENT_KINDS: Array<{ kind: ContentKind; icon: string; one: string; many: string }> = [
  { kind: "offlineMaps", icon: mdiMap, one: "offline map", many: "offline maps" },
  { kind: "rubberSheets", icon: mdiImageArea, one: "rubber sheet", many: "rubber sheets" },
  { kind: "polygons", icon: mdiShapePolygonPlus, one: "polygon", many: "polygons" },
  { kind: "circles", icon: mdiCircleOutline, one: "circle", many: "circles" },
  { kind: "lines", icon: mdiVectorPolyline, one: "line", many: "lines" },
  { kind: "points", icon: mdiMapMarker, one: "point", many: "points" },
];

function contentCounts({ draftContents }: DataPackageDto) {
  return CONTENT_KINDS.filter(({ kind }) => draftContents[kind] > 0).map(({ kind, icon, one, many }) => {
    const count = draftContents[kind];
    return { kind, icon, count, title: `${String(count)} ${count === 1 ? one : many}` };
  });
}

/** Maps outweigh drawn objects; otherwise the most frequent object kind names the package. */
function packageIcon(dataPackage: DataPackageDto): string {
  const counts = contentCounts(dataPackage);
  const map = counts.find(({ kind }) => kind === "offlineMaps" || kind === "rubberSheets");
  const mostFrequent = [...counts].sort((a, b) => b.count - a.count)[0];
  return (map ?? mostFrequent)?.icon ?? mdiMapOutline;
}

const publishingId = ref<string | null>(null);

async function publish(dataPackage: DataPackageDto): Promise<void> {
  publishingId.value = dataPackage.id;
  try {
    const result = await publishDataPackage({ eventId: props.event.id, packageId: dataPackage.id });
    if (result.created) {
      toast.success(`${dataPackage.name}: published revision ${String(result.revision.number)}.`);
    } else {
      toast.info(`${dataPackage.name}: nothing changed since revision ${String(result.revision.number)}.`);
    }
    await dataPackages.load();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    publishingId.value = null;
  }
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
        <v-btn v-if="canEdit" variant="tonal" :prepend-icon="mdiFileImport" :loading="importing" @click="fileInput?.click()">
          Import
        </v-btn>
        <input
          ref="fileInput"
          type="file"
          accept=".zip,.dpk,.cot,.xml,application/zip,application/xml"
          hidden
          @change="importFile"
        >
        <v-btn v-if="canEdit" color="primary" :prepend-icon="mdiMapPlus" @click="(name = ''), creation.reset(), (createOpen = true)">
          New data package
        </v-btn>
      </template>
    </SectionHeader>

    <v-skeleton-loader v-if="dataPackages.state.value === 'loading'" type="list-item-avatar-two-line@3" />
    <ErrorState v-else-if="dataPackages.state.value === 'error'" :message="dataPackages.error.value" @retry="dataPackages.load" />
    <EmptyState v-else-if="dataPackages.data.value.length === 0" title="No data packages yet" text="Create a data package to draw the event's map content." />

    <v-card v-else>
      <VueDraggable
        v-model="rows"
        :animation="180"
        handle=".drag-handle"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :disabled="!canEdit"
        @end="packagesDropped"
      >
        <div
          v-for="dataPackage in rows"
          :key="dataPackage.id"
          class="package-row d-flex align-start flex-wrap flex-md-nowrap ga-4 pa-4"
        >
          <v-icon
            v-if="canEdit && orderedPackages.length > 1"
            :icon="mdiDragVertical"
            class="drag-handle mt-2"
            aria-hidden="true"
          />
          <v-avatar color="primary" variant="tonal" size="40" rounded="lg" class="flex-shrink-0">
            <v-icon :icon="packageIcon(dataPackage)" />
          </v-avatar>
          <div class="package-info">
            <div class="d-flex align-center flex-wrap ga-2 mb-1">
              <span class="text-subtitle-1 font-weight-medium text-break">{{ dataPackage.name }}</span>
              <v-chip
                v-if="dataPackage.latestRevision"
                size="small"
                color="success"
                variant="tonal"
                label
                :title="`Revision ${String(dataPackage.latestRevision)} is published`"
              >
                Rev. {{ dataPackage.latestRevision }}
              </v-chip>
              <v-chip v-else size="small" variant="tonal" label>Draft</v-chip>
              <v-chip
                v-if="dataPackage.latestRevision && dataPackage.hasUnpublishedChanges"
                size="small"
                color="warning"
                variant="tonal"
                label
                title="The draft has changes that members do not receive yet"
              >
                Unpublished
              </v-chip>
            </div>
            <div class="facts text-body-2">
              <span class="fact" :title="audienceTitle(dataPackage)">
                <v-icon :icon="mdiAccountGroup" size="16" />
                <span class="text-truncate">{{ audienceLabel(dataPackage) }}</span>
                <span v-if="audienceReach(dataPackage)" class="text-medium-emphasis">{{ audienceReach(dataPackage) }}</span>
              </span>
              <span class="fact" :title="takDeliverySummary(dataPackage).title">
                <v-icon :icon="mdiCellphoneArrowDown" size="16" />
                {{ takDeliverySummary(dataPackage).label }}
              </span>
              <span v-if="dataPackage.latestRevisionSize !== null" class="fact" title="Approximate download size of the published revision">
                <v-icon :icon="mdiPackageVariantClosed" size="16" />
                {{ formatSize(dataPackage.latestRevisionSize) }}
              </span>
              <span v-for="content in contentCounts(dataPackage)" :key="content.kind" class="fact" :title="content.title">
                <v-icon :icon="content.icon" size="16" />
                {{ content.count }}
              </span>
              <span class="fact text-medium-emphasis" title="Last changed">
                <v-icon :icon="mdiClockOutline" size="16" />
                {{ dateFormat.format(new Date(dataPackage.updatedAt)) }}
              </span>
            </div>
          </div>
          <div class="row-actions d-flex align-center flex-wrap ga-1">
            <v-btn
              v-if="canPublish"
              color="primary"
              variant="tonal"
              size="small"
              :prepend-icon="mdiPublish"
              :loading="publishingId === dataPackage.id"
              :disabled="!dataPackage.hasUnpublishedChanges"
              :title="dataPackage.hasUnpublishedChanges ? undefined : 'The draft matches the published revision.'"
              @click="publish(dataPackage)"
            >
              Publish
            </v-btn>
            <v-btn v-if="canPublish" variant="tonal" size="small" :prepend-icon="mdiAccountGroup" @click="editAudience(dataPackage)">
              Delivery
            </v-btn>
            <v-btn variant="tonal" size="small" @click="openEditor(dataPackage)">{{ canEdit ? "Open editor" : "View" }}</v-btn>
            <v-btn
              v-if="canEdit"
              :icon="mdiDelete"
              variant="text"
              size="small"
              color="error"
              :aria-label="`Delete ${dataPackage.name}`"
              @click="removing = dataPackage"
            />
          </div>
        </div>
      </VueDraggable>
    </v-card>

    <ImportReportDialog v-model="reportOpen" :report="importReport" />
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
.package-row + .package-row {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.package-info {
  flex: 1 1 260px;
  min-width: 0;
}
.row-actions {
  margin-inline-start: auto;
}
.drag-handle {
  cursor: grab;
  opacity: 0.6;
}
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
