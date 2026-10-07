<script setup lang="ts">
import { mdiContentCopy, mdiDownload } from "@mdi/js";
import { computed, ref, watch } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { saveFile } from "@/shared/files/save-file";
import {
  downloadCombinedExport,
  createDataPackageCopy,
  previewCombinedExport,
  type CombinedExportReport,
  type DataPackageDto,
} from "../data-packages.api";

/**
 * Picks published packages, shows Core's report (included, skipped, equal names) and downloads
 * one combined ATAK Data Package built from the newest published revisions.
 */
const open = defineModel<boolean>({ required: true });
const props = defineProps<{ eventId: string; eventName: string; packages: DataPackageDto[]; canCreateDraft: boolean }>();
const emit = defineEmits<{ created: [dataPackage: DataPackageDto] }>();
const toast = useToast();

const selectedIds = ref<string[]>([]);
const name = ref("");
const report = ref<CombinedExportReport | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const published = computed(() => props.packages.filter(({ latestRevision }) => latestRevision !== null));
const request = computed(() => ({
  ...(name.value.trim() === "" ? {} : { name: name.value.trim() }),
  packages: selectedIds.value.map((packageId) => ({ packageId })),
}));

watch(open, (isOpen) => {
  if (isOpen) {
    selectedIds.value = published.value.map(({ id }) => id);
    name.value = props.eventName;
    report.value = null;
    error.value = null;
  }
});

// The report belongs to one exact selection; any change asks for a fresh check.
watch(selectedIds, () => {
  report.value = null;
});

async function check(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    report.value = await previewCombinedExport(props.eventId, request.value);
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    busy.value = false;
  }
}

async function download(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const { blob, fileName } = await downloadCombinedExport(props.eventId, request.value);
    saveFile(blob, fileName);
    open.value = false;
    toast.success(`${fileName} was downloaded.`);
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    busy.value = false;
  }
}

async function createDraft(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const created = await createDataPackageCopy(props.eventId, {
      name: name.value.trim() || props.eventName,
      packages: request.value.packages,
    });
    open.value = false;
    emit("created", created);
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="600" scrollable>
    <v-card class="pa-2">
      <v-card-title>Export data packages</v-card-title>
      <v-card-text>
        <p class="text-body-medium text-medium-emphasis mt-0 mb-4">
          Combines the newest published revisions into one ATAK Data Package. Drafts are never
          exported.
        </p>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <v-text-field v-model="name" label="Name of the combined package" maxlength="100" class="mb-2" />

        <div class="text-title-small mb-1">Packages</div>
        <v-checkbox
          v-for="dataPackage in packages"
          :key="dataPackage.id"
          v-model="selectedIds"
          :value="dataPackage.id"
          :label="dataPackage.latestRevision ? `${dataPackage.name} · revision ${dataPackage.latestRevision}` : `${dataPackage.name} · not published`"
          :disabled="dataPackage.latestRevision === null"
          density="compact"
          hide-details
        />

        <template v-if="report">
          <v-divider class="my-4" />
          <div class="text-title-small mb-2">Check</div>
          <p class="text-body-medium mt-0 mb-2">
            {{ report.included.reduce((sum, part) => sum + part.objects, 0) }} objects from
            {{ report.included.length }} {{ report.included.length === 1 ? "package" : "packages" }}.
          </p>
          <v-alert v-if="report.skipped.length > 0" type="info" density="compact" class="mb-2">
            Skipped, not published: {{ report.skipped.map(({ name }) => name).join(", ") }}
          </v-alert>
          <v-alert v-if="report.nameClashes.length > 0" type="warning" density="compact">
            Used in more than one package, both objects are kept:
            {{ report.nameClashes.map(({ name }) => name).join(", ") }}
          </v-alert>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="busy" @click="open = false">Cancel</v-btn>
        <v-btn v-if="report === null" color="primary" :disabled="selectedIds.length === 0" :loading="busy" @click="check">
          Check
        </v-btn>
        <template v-else>
          <v-btn
            v-if="canCreateDraft"
            variant="tonal"
            :prepend-icon="mdiContentCopy"
            :disabled="busy"
            @click="createDraft"
          >
            Create editable package
          </v-btn>
          <v-btn color="primary" :prepend-icon="mdiDownload" :loading="busy" @click="download">Download .zip</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
