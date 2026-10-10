<script setup lang="ts">
import { ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { messagesFor } from "@/shared/errors/field-errors";
import type { BaseMapLayer } from "./map-settings.api";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  /** A copy to edit; a layer not yet in the list is added on save. */
  layer: BaseMapLayer;
  adding: boolean;
  saving: boolean;
  /** Field errors of this layer, keyed by field name. */
  errors: Record<string, string>;
  formError: string | null;
}>();
const emit = defineEmits<{ save: [layer: BaseMapLayer] }>();

// Bound from script: a literal {z}/{x}/{y} attribute confuses vue-tsc template scoping.
const tileUrlPlaceholder = "https://tiles.example.org/{z}/{x}/{y}.png";
const form = ref<BaseMapLayer>({ ...props.layer });
watch(open, (isOpen) => { if (isOpen) form.value = { ...props.layer }; });

function isEsriImagery(url: string): boolean {
  return url.includes("services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/");
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" :persistent="saving">
    <v-card class="pa-2">
      <v-card-title>{{ adding ? "Add base map" : `Edit ${layer.providerName || "base map"}` }}</v-card-title>
      <v-card-text>
        <v-alert v-if="formError" type="error" density="compact" class="mb-4">{{ formError }}</v-alert>
        <v-row dense>
          <v-col cols="8"><v-text-field v-model="form.providerName" label="Map name" maxlength="100" autofocus :error-messages="messagesFor(errors, 'providerName')" /></v-col>
          <v-col cols="4"><v-text-field v-model.number="form.maxZoom" type="number" label="Max zoom" min="1" max="22" :error-messages="messagesFor(errors, 'maxZoom')" /></v-col>
          <v-col cols="12">
            <v-text-field v-model="form.tileUrlTemplate" label="Tile URL" :placeholder="tileUrlPlaceholder" :error-messages="messagesFor(errors, 'tileUrlTemplate')">
              <template #append-inner><InfoHint label="About tile URL" text="An HTTPS XYZ template with {z}, {x} and {y}, or {-y} for TMS. The URL is visible to signed-in users; never put private server credentials here." /></template>
            </v-text-field>
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="form.attribution" label="Attribution" maxlength="300" :error-messages="messagesFor(errors, 'attribution')">
              <template #append-inner><InfoHint label="About attribution" text="The source attribution your provider requires. It is shown whenever this map is selected." /></template>
            </v-text-field>
          </v-col>
        </v-row>
        <p v-if="isEsriImagery(form.tileUrlTemplate)" class="text-body-small text-medium-emphasis mb-0">
          Esri World Imagery uses the <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">provider's terms of use</a>. It streams imagery online; it is not an offline tile export.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" @click="emit('save', form)">{{ adding ? "Add" : "Save" }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
