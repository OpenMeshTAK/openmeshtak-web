<script setup lang="ts">
import { onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { loadBaseMap, saveMapSettings, type MapSettingsChanges, type MapSettingsDto } from "./map-settings.api";

/**
 * The online base map every map in OpenMeshTak shows. OpenStreetMap's public tiles are a
 * development default with a strict usage policy; production installations should use their own
 * or a contracted tile provider and enter its required attribution.
 */
const toast = useToast();
const page = useAsyncData(loadBaseMap, null as MapSettingsDto | null);
const form = ref<MapSettingsChanges>({ providerName: "", tileUrlTemplate: "", attribution: "", maxZoom: 19 });
const saving = ref(false);
const errors = ref<Record<string, string>>({});

function show(settings: MapSettingsDto): void {
  page.data.value = settings;
  form.value = {
    providerName: settings.providerName,
    tileUrlTemplate: settings.tileUrlTemplate,
    attribution: settings.attribution,
    maxZoom: settings.maxZoom,
  };
}

async function save(): Promise<void> {
  if (page.data.value === null) {
    return;
  }
  saving.value = true;
  errors.value = {};
  try {
    show(await saveMapSettings(page.data.value.version, form.value));
    toast.success("Base map saved. Open maps use it after a reload.");
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await page.load();
  if (page.data.value !== null) {
    show(page.data.value);
  }
});
</script>

<template>
  <ViewContent>
    <ViewHeader title="Base map" subtitle="The online map shown below all Data Packages, in the editor and the live view." />
    <v-skeleton-loader v-if="page.state.value === 'loading'" type="article" />
    <ErrorState v-else-if="page.state.value === 'error' || page.data.value === null" :message="page.error.value" @retry="page.load" />
    <v-card v-else class="pa-5" style="max-width: 760px">
      <v-alert v-if="page.data.value.version === 0" type="info" variant="tonal" density="compact" class="mb-4">
        OpenStreetMap's public tiles are a default for development and small events. Their usage
        policy forbids heavy use and bulk downloads; use your own or a contracted provider for real
        operations.
      </v-alert>
      <v-row dense>
        <v-col cols="12" sm="8"><v-text-field v-model="form.providerName" label="Provider name" /></v-col>
        <v-col cols="12" sm="4"><v-text-field v-model.number="form.maxZoom" type="number" label="Max zoom" /></v-col>
        <v-col cols="12">
          <v-text-field
            v-model="form.tileUrlTemplate"
            label="Tile URL"
            hint="HTTPS XYZ template with {z}, {x} and {y}, e.g. https://tile.example.org/{z}/{x}/{y}.png"
            persistent-hint
            :error-messages="messagesFor(errors, 'tileUrlTemplate')"
          />
        </v-col>
        <v-col cols="12">
          <v-text-field
            v-model="form.attribution"
            label="Attribution"
            hint="Shown on every map, exactly as the provider requires."
            persistent-hint
            :error-messages="messagesFor(errors, 'attribution')"
          />
        </v-col>
      </v-row>
      <div class="d-flex justify-end mt-4">
        <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
      </div>
    </v-card>
  </ViewContent>
</template>
