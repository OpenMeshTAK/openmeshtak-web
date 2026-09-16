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
import { createDataPackage, deleteDataPackage, listDataPackages, type DataPackageDto } from "./data-packages.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const router = useRouter();
const session = useSession();
const toast = useToast();

const dataPackages = useAsyncData(() => listDataPackages(props.event.id), [] as DataPackageDto[]);
const canEdit = computed(() => props.event.status !== "archived" && session.can("data-packages.edit", props.event.id));

const createOpen = ref(false);
const name = ref("");
const creation = useSubmission();
const removing = ref<DataPackageDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function openEditor(dataPackage: DataPackageDto): void {
  void router.push({ name: "package-editor", params: { eventId: props.event.id, packageId: dataPackage.id } });
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

onMounted(dataPackages.load);
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4 ga-4 flex-wrap">
      <p class="text-body-2 text-medium-emphasis flex-grow-1 mb-0">
        Data packages hold the event's map content: markers, lines and areas in layers. Participants
        receive published revisions, never the draft.
      </p>
      <v-btn v-if="canEdit" color="primary" :prepend-icon="mdiMapPlus" @click="(name = ''), creation.reset(), (createOpen = true)">
        New data package
      </v-btn>
    </div>

    <v-skeleton-loader v-if="dataPackages.state.value === 'loading'" type="table" />
    <ErrorState v-else-if="dataPackages.state.value === 'error'" :message="dataPackages.error.value" @retry="dataPackages.load" />
    <EmptyState v-else-if="dataPackages.data.value.length === 0" title="No data packages yet" text="Create a data package to draw the event's map content." />

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
          <tr v-for="dataPackage in dataPackages.data.value" :key="dataPackage.id" style="cursor: pointer" @click="openEditor(dataPackage)">
            <td class="font-weight-medium">{{ dataPackage.name }}</td>
            <td>
              <span v-if="dataPackage.latestRevision">Revision {{ dataPackage.latestRevision }}</span>
              <v-chip v-else size="small" variant="tonal" label>Draft only</v-chip>
            </td>
            <td class="d-none d-md-table-cell">{{ dateFormat.format(new Date(dataPackage.updatedAt)) }}</td>
            <td class="text-right text-no-wrap">
              <v-btn variant="text" size="small" @click.stop="openEditor(dataPackage)">{{ canEdit ? "Edit" : "View" }}</v-btn>
              <v-btn v-if="canEdit" variant="text" size="small" color="error" @click.stop="removing = dataPackage">Delete</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

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
