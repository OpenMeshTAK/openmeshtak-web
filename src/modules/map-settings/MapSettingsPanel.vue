<script setup lang="ts">
import { mdiDotsVertical, mdiMapOutline, mdiPencilOutline, mdiPlus, mdiSatelliteVariant, mdiStarOutline, mdiTrashCanOutline } from "@mdi/js";
import { onMounted, ref } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import FormSection from "@/shared/components/layout/FormSection.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { fieldErrors } from "@/shared/errors/field-errors";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { getMapSettings, saveMapSettings, type BaseMapLayer, type MapSettingsDto } from "./map-settings.api";
import { newBaseMapLayer, type BaseMapPreset } from "./base-map-presets";
import BaseMapLayerDialog from "./BaseMapLayerDialog.vue";

/**
 * A compact list of the base maps; each change saves at once. Editing happens in a dialog so the
 * card stays short however many maps are configured.
 */
const MAX_LAYERS = 10;
const toast = useToast();
const page = useAsyncData(getMapSettings, null as MapSettingsDto | null);
const saving = ref(false);
const editing = ref<BaseMapLayer | null>(null);
const editOpen = ref(false);
const adding = ref(false);
const editErrors = ref<Record<string, string>>({});
const editError = ref<string | null>(null);
const removing = ref<BaseMapLayer | null>(null);

function isNew(layer: BaseMapLayer): boolean {
  return !page.data.value?.layers.some(({ id }) => id === layer.id);
}

/** The host is enough to tell maps apart; the full template is in the edit dialog. */
function describe(layer: BaseMapLayer): string {
  let host = layer.tileUrlTemplate;
  try { host = new URL(layer.tileUrlTemplate).host; } catch { /* keep the raw template */ }
  return `${host} · max zoom ${layer.maxZoom}`;
}

async function persist(layers: BaseMapLayer[], defaultLayerId: string): Promise<void> {
  const current = page.data.value;
  const selected = layers.find(({ id }) => id === defaultLayerId);
  if (current === null || selected === undefined) return;
  page.data.value = await saveMapSettings(current.version, {
    providerName: selected.providerName, tileUrlTemplate: selected.tileUrlTemplate, attribution: selected.attribution, maxZoom: selected.maxZoom,
    layers, defaultLayerId,
  });
}

/** Saves from the list itself (default, removal): failures only need a toast. */
async function change(layers: BaseMapLayer[], defaultLayerId: string, success: string): Promise<boolean> {
  saving.value = true;
  try {
    await persist(layers, defaultLayerId);
    toast.success(success);
    return true;
  } catch (caught: unknown) {
    toast.error(caught);
    if (isApiProblem(caught, "VERSION_CONFLICT")) await page.load();
    return false;
  } finally { saving.value = false; }
}

function edit(layer: BaseMapLayer): void {
  adding.value = isNew(layer);
  editing.value = { ...layer };
  editErrors.value = {};
  editError.value = null;
  editOpen.value = true;
}

function add(preset: BaseMapPreset): void {
  edit(newBaseMapLayer(preset));
}

async function saveEdit(layer: BaseMapLayer): Promise<void> {
  const current = page.data.value;
  if (current === null) return;
  const layers = adding.value ? [...current.layers, layer] : current.layers.map((existing) => existing.id === layer.id ? layer : existing);
  const prefix = `layers.${layers.findIndex(({ id }) => id === layer.id)}.`;
  saving.value = true;
  editErrors.value = {};
  editError.value = null;
  try {
    await persist(layers, current.defaultLayerId);
    editOpen.value = false;
    toast.success("Base map saved. Reload open maps to use it.");
  } catch (caught: unknown) {
    // tsoa reports array indices as .$0; service validation uses .0. Only this layer's fields belong in the dialog.
    const fields = Object.entries(fieldErrors(caught)).map(([field, message]) => [field.replace(/\.\$(\d+)/g, ".$1"), message] as const);
    editErrors.value = Object.fromEntries(fields.filter(([field]) => field.startsWith(prefix)).map(([field, message]) => [field.slice(prefix.length), message]));
    if (Object.keys(editErrors.value).length === 0) editError.value = describeError(caught);
    if (isApiProblem(caught, "VERSION_CONFLICT")) await page.load();
  } finally { saving.value = false; }
}

async function makeDefault(layer: BaseMapLayer): Promise<void> {
  if (page.data.value === null) return;
  await change(page.data.value.layers, layer.id, `${layer.providerName} is now the default map.`);
}

async function confirmRemove(): Promise<void> {
  const current = page.data.value;
  const layer = removing.value;
  if (current === null || layer === null) return;
  const layers = current.layers.filter(({ id }) => id !== layer.id);
  const defaultLayerId = current.defaultLayerId === layer.id ? layers[0]?.id ?? "" : current.defaultLayerId;
  if (await change(layers, defaultLayerId, `${layer.providerName} removed.`)) removing.value = null;
}

onMounted(page.load);
</script>

<template>
  <FormSection title="Base maps" description="The maps people can switch between in every editor and live view.">
    <template v-if="page.state.value === 'ready' && page.data.value" #actions>
      <div class="d-flex align-center ga-1">
        <InfoHint label="About base maps">
          <p class="mb-2">Up to {{ MAX_LAYERS }} maps. Only the selected map loads tiles; imported offline maps and mission layers stay above it.</p>
          <p class="mb-0">Use a provider suited to your installation. OpenStreetMap's public tiles are a development default; bulk tile downloads are not supported.</p>
        </InfoHint>
        <v-menu location="bottom end">
          <template #activator="{ props: activator }">
            <v-btn v-bind="activator" variant="tonal" color="primary" :prepend-icon="mdiPlus" :disabled="saving || page.data.value.layers.length >= MAX_LAYERS">Add map</v-btn>
          </template>
          <v-list density="compact">
            <v-list-item :prepend-icon="mdiMapOutline" title="Street map" subtitle="OpenStreetMap" @click="add('street')" />
            <v-list-item :prepend-icon="mdiSatelliteVariant" title="Satellite" subtitle="Esri World Imagery" @click="add('satellite')" />
            <v-list-item :prepend-icon="mdiPlus" title="Custom map" subtitle="Your own XYZ tile URL" @click="add('custom')" />
          </v-list>
        </v-menu>
      </div>
    </template>

    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="list-item-two-line" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="page.load" /></div>
    <v-list v-else lines="two" class="pt-1 pb-2">
      <v-list-item
        v-for="layer in page.data.value.layers"
        :key="layer.id"
        :title="layer.providerName"
        :subtitle="describe(layer)"
        :disabled="saving"
        @click="edit(layer)"
      >
        <template #append>
          <div class="d-flex align-center ga-1">
            <v-chip v-if="layer.id === page.data.value.defaultLayerId" size="small" variant="tonal" color="primary">Default</v-chip>
            <v-menu location="bottom end">
              <template #activator="{ props: activator }">
                <v-btn v-bind="activator" :icon="mdiDotsVertical" variant="text" size="small" :aria-label="`Actions for ${layer.providerName}`" @click.stop />
              </template>
              <v-list density="compact">
                <v-list-item :prepend-icon="mdiPencilOutline" title="Edit" @click="edit(layer)" />
                <v-list-item v-if="layer.id !== page.data.value.defaultLayerId" :prepend-icon="mdiStarOutline" title="Make default" @click="makeDefault(layer)" />
                <v-list-item v-if="page.data.value.layers.length > 1" :prepend-icon="mdiTrashCanOutline" title="Remove" base-color="error" @click="removing = layer" />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <BaseMapLayerDialog
      v-if="editing"
      v-model="editOpen"
      :layer="editing"
      :adding="adding"
      :saving="saving"
      :errors="editErrors"
      :form-error="editError"
      @save="saveEdit"
    />
    <ConfirmDialog
      :model-value="removing !== null"
      :title="`Remove ${removing?.providerName ?? 'this map'}?`"
      confirm-label="Remove"
      confirm-color="error"
      :loading="saving"
      @update:model-value="removing = null"
      @confirm="confirmRemove"
    >
      People can no longer select it. Open maps keep it until they are reloaded{{ removing?.id === page.data.value?.defaultLayerId ? "; the first remaining map becomes the default" : "" }}.
    </ConfirmDialog>
  </FormSection>
</template>
