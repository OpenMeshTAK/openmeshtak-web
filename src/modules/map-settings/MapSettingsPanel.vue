<script setup lang="ts">
import { mdiDeleteOutline, mdiMapOutline, mdiPlus, mdiSatelliteVariant } from "@mdi/js";
import { onMounted, ref } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import FormSection from "@/shared/components/layout/FormSection.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { getMapSettings, saveMapSettings, type BaseMapLayer, type MapSettingsDto } from "./map-settings.api";
import { newBaseMapLayer, type BaseMapPreset } from "./base-map-presets";

// Bound from script: a literal {z}/{x}/{y} attribute confuses vue-tsc template scoping.
const tileUrlPlaceholder = "https://tiles.example.org/{z}/{x}/{y}.png";
const toast = useToast();
const page = useAsyncData(getMapSettings, null as MapSettingsDto | null);
const layers = ref<BaseMapLayer[]>([]);
const defaultLayerId = ref("");
const saving = ref(false);
const errors = ref<Record<string, string>>({});
function show(settings: MapSettingsDto): void {
  page.data.value = settings;
  layers.value = settings.layers.map((layer) => ({ ...layer }));
  defaultLayerId.value = settings.defaultLayerId;
}
function add(preset: BaseMapPreset): void {
  if (layers.value.length >= 10) return;
  layers.value.push(newBaseMapLayer(preset));
  errors.value = {};
}
function remove(id: string): void {
  if (layers.value.length <= 1) return;
  layers.value = layers.value.filter((layer) => layer.id !== id);
  if (defaultLayerId.value === id) defaultLayerId.value = layers.value[0]?.id ?? "";
  errors.value = {};
}
async function load(): Promise<void> {
  await page.load();
  if (page.state.value === "ready" && page.data.value !== null) show(page.data.value);
}
async function save(): Promise<void> {
  const selected = layers.value.find(({ id }) => id === defaultLayerId.value);
  if (page.data.value === null || selected === undefined) return;
  saving.value = true;
  errors.value = {};
  try {
    show(await saveMapSettings(page.data.value.version, {
      providerName: selected.providerName, tileUrlTemplate: selected.tileUrlTemplate, attribution: selected.attribution, maxZoom: selected.maxZoom,
      layers: layers.value, defaultLayerId: defaultLayerId.value,
    }));
    toast.success("Base maps saved. Reload open maps to use the new list.");
  } catch (caught: unknown) {
    // tsoa reports array indices as .$0; service validation uses .0.
    errors.value = Object.fromEntries(Object.entries(fieldErrors(caught)).map(([field, message]) => [field.replace(/\.\$(\d+)/g, '.$1'), message]));
    toast.error(caught);
    if (isApiProblem(caught, "VERSION_CONFLICT")) await load();
  } finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <FormSection title="Base maps" description="Switch between street, satellite and your own maps in every editor and live view.">
    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="article" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="load" /></div>
    <div v-else class="px-4 pb-4 pt-3">
      <p class="text-body-small text-medium-emphasis mb-3">Configure up to ten maps. Only the selected map loads tiles; imported offline maps and mission layers stay above it.</p>
      <v-alert v-if="errors.layers || errors.defaultLayerId" type="error" density="compact" class="mb-3">{{ errors.layers || errors.defaultLayerId }}</v-alert>
      <v-radio-group v-model="defaultLayerId" :disabled="saving" hide-details>
        <v-card v-for="(layer, index) in layers" :key="layer.id" class="pa-3 mb-3">
          <div class="d-flex align-center justify-space-between mb-2">
            <v-radio :value="layer.id" :label="defaultLayerId === layer.id ? 'Default map' : 'Use as default'" />
            <v-btn :icon="mdiDeleteOutline" variant="text" size="small" :disabled="saving || layers.length === 1" :aria-label="`Remove ${layer.providerName || 'map'}`" @click="remove(layer.id)" />
          </div>
          <v-row dense>
            <v-col cols="12" sm="8"><v-text-field v-model="layer.providerName" label="Map name" maxlength="100" :disabled="saving" :error-messages="messagesFor(errors, `layers.${index}.providerName`)" /></v-col>
            <v-col cols="12" sm="4"><v-text-field v-model.number="layer.maxZoom" type="number" label="Max zoom" min="1" max="22" :disabled="saving" :error-messages="messagesFor(errors, `layers.${index}.maxZoom`)" /></v-col>
            <v-col cols="12">
              <v-text-field v-model="layer.tileUrlTemplate" label="Tile URL" :placeholder="tileUrlPlaceholder" :disabled="saving" :error-messages="messagesFor(errors, `layers.${index}.tileUrlTemplate`)">
                <template #append-inner><InfoHint label="About tile URL" text="An HTTPS XYZ template with {z}, {x} and {y}, or {-y} for TMS. The URL is visible to signed-in users; never put private server credentials here." /></template>
              </v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="layer.attribution" label="Attribution" maxlength="300" :disabled="saving" :error-messages="messagesFor(errors, `layers.${index}.attribution`)">
                <template #append-inner><InfoHint label="About attribution" text="Enter the source attribution required by your provider. It is shown whenever this map is selected." /></template>
              </v-text-field>
            </v-col>
          </v-row>
          <p v-if="layer.tileUrlTemplate.includes('services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/')" class="text-body-small text-medium-emphasis mb-0">Esri World Imagery uses the <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">provider's terms of use</a>. This layer streams imagery online; it is not an offline tile export.</p>
        </v-card>
      </v-radio-group>
      <div class="d-flex flex-wrap ga-2 mb-3">
        <v-btn variant="tonal" :prepend-icon="mdiMapOutline" :disabled="saving || layers.length >= 10" @click="add('street')">Street</v-btn>
        <v-btn variant="tonal" :prepend-icon="mdiSatelliteVariant" :disabled="saving || layers.length >= 10" @click="add('satellite')">Satellite</v-btn>
        <v-btn variant="text" :prepend-icon="mdiPlus" :disabled="saving || layers.length >= 10" @click="add('custom')">Custom map</v-btn>
      </div>
      <p class="text-body-small text-medium-emphasis">Use a provider suited to your installation. OpenStreetMap's public tiles are a development default; bulk tile downloads are not supported.</p>
      <div class="d-flex justify-end"><v-btn color="primary" :loading="saving" @click="save">Save</v-btn></div>
    </div>
  </FormSection>
</template>
