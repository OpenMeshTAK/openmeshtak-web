<script setup lang="ts">
import { onMounted, ref } from "vue";
import { mdiDatabaseArrowUpOutline, mdiDeleteOutline } from "@mdi/js";
import FormSection from "@/shared/components/layout/FormSection.vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { getIconSettings, removeInstanceIcons, uploadInstanceIcons, type IconSettings, type IconSettingsResult } from "./icon-settings.api";

const toast = useToast();
const page = useAsyncData(getIconSettings, null as IconSettings | null);
const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const removalOpen = ref(false);
const replaceOpen = ref(false);
const chosenFile = ref<File | null>(null);
const result = ref<IconSettingsResult | null>(null);
onMounted(page.load);

function choose(event: Event): void {
  const field = event.target as HTMLInputElement;
  const file = field.files?.[0];
  field.value = "";
  if (file === undefined) return;
  if (file.size > 10 * 1024 * 1024) { toast.warning("The icon database must be at most 10 MB."); return; }
  chosenFile.value = file;
  if ((page.data.value?.icons ?? 0) > 0) replaceOpen.value = true;
  else void upload();
}
async function upload(): Promise<void> {
  if (page.data.value === null || chosenFile.value === null) return;
  busy.value = true;
  try {
    result.value = await uploadInstanceIcons(page.data.value.version, chosenFile.value);
    page.data.value = result.value.settings;
    toast.success(`${result.value.accepted} icons imported for all editors. Reload other open editor tabs to use the new database.`);
    replaceOpen.value = false;
    chosenFile.value = null;
  } catch (caught: unknown) {
    toast.error(caught);
    if (isApiProblem(caught, "VERSION_CONFLICT")) { replaceOpen.value = false; chosenFile.value = null; await page.load(); }
  } finally { busy.value = false; }
}
async function remove(): Promise<void> {
  if (page.data.value === null) return;
  busy.value = true;
  try {
    page.data.value = await removeInstanceIcons(page.data.value.version);
    result.value = null;
    removalOpen.value = false;
    toast.success("Shared icons removed. Stored marker paths are kept.");
  } catch (caught: unknown) {
    toast.error(caught);
    if (isApiProblem(caught, "VERSION_CONFLICT")) { removalOpen.value = false; await page.load(); }
  } finally { busy.value = false; }
}
</script>

<template>
  <FormSection title="Icon sets" description="A shared WinTAK icon database for all Data Package and mission editors.">
    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="article" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="page.load" /></div>
    <div v-else class="px-4 pb-4 pt-3">
      <p class="text-body-medium">Close WinTAK, then copy and upload <code>%APPDATA%\WinTAK\Databases\iconsets.sqlite</code>.</p>
      <p class="text-body-small text-medium-emphasis mb-3">Installed assets are also under <code>C:\Program Files\WinTAK\Assets</code>. Upload accepts the SQLite database (up to 10 MB). You are responsible for permission to use these images.</p>
      <v-alert :type="page.data.value.icons > 0 ? 'success' : 'info'" variant="tonal" density="compact" class="mb-3">
        <template v-if="page.data.value.icons > 0">{{ page.data.value.icons }} icons · {{ page.data.value.sets }} sets · {{ page.data.value.groups }} groups</template>
        <template v-else>No shared icon database uploaded.</template>
      </v-alert>
      <p v-if="page.data.value.updatedAt" class="text-body-small text-medium-emphasis">Last changed: {{ new Date(page.data.value.updatedAt).toLocaleString() }}</p>
      <v-alert v-if="result?.rejected.length" type="warning" density="compact" class="my-3">{{ result.rejected.length }} entries could not be imported.</v-alert>
      <v-expansion-panels v-if="result?.rejected.length" class="mb-3"><v-expansion-panel title="Rejected entries"><v-expansion-panel-text><p v-for="entry in result.rejected" :key="entry.feature">{{ entry.feature }}: {{ entry.message }}</p></v-expansion-panel-text></v-expansion-panel></v-expansion-panels>
      <input ref="input" type="file" accept=".sqlite,.db" hidden @change="choose">
      <div class="d-flex justify-end flex-wrap ga-2">
        <v-btn v-if="page.data.value.icons > 0" variant="text" color="error" :prepend-icon="mdiDeleteOutline" :disabled="busy" @click="removalOpen = true">Remove</v-btn>
        <v-btn color="primary" :prepend-icon="mdiDatabaseArrowUpOutline" :loading="busy" @click="input?.click()">{{ page.data.value.icons > 0 ? 'Replace database' : 'Upload iconsets.sqlite' }}</v-btn>
      </div>
      <p class="text-body-small text-medium-emphasis mt-3 mb-0">The editor matches existing TAK icon paths automatically. TAK clients need the same set installed separately; uploaded images are not included in TAK exports.</p>
    </div>
    <ConfirmDialog v-model="replaceOpen" title="Replace the shared icon database?" confirm-label="Replace" :loading="busy" @confirm="upload">
      {{ chosenFile?.name }} replaces the shared images used by all editors. Marker paths stay unchanged; paths absent from the new database use fallback symbols.
    </ConfirmDialog>
    <ConfirmDialog v-model="removalOpen" title="Remove the shared icon database?" confirm-label="Remove" confirm-color="error" :loading="busy" @confirm="remove">
      All editors return to fallback symbols for shared icons. Marker paths and package-specific icon libraries are kept.
    </ConfirmDialog>
  </FormSection>
</template>
