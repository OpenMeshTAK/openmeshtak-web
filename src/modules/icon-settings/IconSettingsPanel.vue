<script setup lang="ts">
import { onMounted, ref } from "vue";
import { mdiDatabaseArrowUpOutline, mdiTrashCanOutline } from "@mdi/js";
import InfoHint from "@/shared/components/InfoHint.vue";
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
  <FormSection title="Icon sets" description="Shared WinTAK icons for every Data Package and mission editor.">
    <template #actions>
      <div class="d-flex align-center ga-1">
        <InfoHint label="About icon sets">
          <p class="mb-2">Close WinTAK, then upload <code>%APPDATA%\WinTAK\Databases\iconsets.sqlite</code> (up to 10 MB). Installed assets are also under <code>C:\Program Files\WinTAK\Assets</code>.</p>
          <p class="mb-0">The editor matches existing TAK icon paths automatically.</p>
        </InfoHint>
        <InfoHint tone="warning" label="Icon set caveats">
          <p class="mb-2">TAK clients need the same icon set installed separately; uploaded images are not included in TAK exports.</p>
          <p class="mb-0">You are responsible for permission to use these images.</p>
        </InfoHint>
      </div>
    </template>
    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="list-item-two-line" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="page.load" /></div>
    <div v-else class="d-flex align-center flex-wrap ga-3 px-4 pb-4 pt-3">
      <div class="flex-grow-1">
        <template v-if="page.data.value.icons > 0">
          <div class="text-body-large">{{ page.data.value.icons }} icons · {{ page.data.value.sets }} sets · {{ page.data.value.groups }} groups</div>
          <div v-if="page.data.value.updatedAt" class="text-body-medium text-medium-emphasis">Changed {{ new Date(page.data.value.updatedAt).toLocaleString() }}</div>
        </template>
        <div v-else class="text-body-medium text-medium-emphasis">No icon database uploaded. Editors use fallback symbols.</div>
        <div v-if="result?.rejected.length" class="d-flex align-center ga-1 text-body-medium text-warning">
          {{ result.rejected.length }} entries could not be imported
          <InfoHint tone="warning" label="Rejected entries">
            <div class="rejected-list"><p v-for="entry in result.rejected" :key="entry.feature" class="mb-1">{{ entry.feature }}: {{ entry.message }}</p></div>
          </InfoHint>
        </div>
      </div>
      <input ref="input" type="file" accept=".sqlite,.db" hidden @change="choose">
      <div class="d-flex align-center ga-1">
        <v-btn v-if="page.data.value.icons > 0" :icon="mdiTrashCanOutline" variant="text" size="small" color="error" aria-label="Remove icon database" :disabled="busy" @click="removalOpen = true" />
        <v-btn color="primary" variant="tonal" :prepend-icon="mdiDatabaseArrowUpOutline" :loading="busy" @click="input?.click()">{{ page.data.value.icons > 0 ? 'Replace' : 'Upload' }}</v-btn>
      </div>
    </div>
    <ConfirmDialog v-model="replaceOpen" title="Replace the shared icon database?" confirm-label="Replace" :loading="busy" @confirm="upload">
      {{ chosenFile?.name }} replaces the shared images used by all editors. Marker paths stay unchanged; paths absent from the new database use fallback symbols.
    </ConfirmDialog>
    <ConfirmDialog v-model="removalOpen" title="Remove the shared icon database?" confirm-label="Remove" confirm-color="error" :loading="busy" @confirm="remove">
      All editors return to fallback symbols for shared icons. Marker paths and package-specific icon libraries are kept.
    </ConfirmDialog>
  </FormSection>
</template>

<style scoped>
/* A large import can reject many entries; keep the hint within the screen. */
.rejected-list {
  max-height: 280px;
  overflow-y: auto;
}
</style>
