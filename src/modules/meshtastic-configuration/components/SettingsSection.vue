<script setup lang="ts">
import { mdiLock } from "@mdi/js";
import { computed } from "vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import type { FirmwareFieldDto, SettingValue } from "../meshtastic-configuration.api";
import FirmwareFieldInput from "./FirmwareFieldInput.vue";

/**
 * One profile section such as LoRa, rendered only from the profile's field definitions: values in
 * a two-column grid, on/off settings as a list with their explanation, and server-managed values
 * read-only at the end.
 */
const props = defineProps<{
  label: string;
  fields: FirmwareFieldDto[];
  enums: Record<string, string[]>;
  editable: boolean;
  errors: Record<string, string>;
}>();
const settings = defineModel<Record<string, SettingValue | undefined>>({ required: true });

const valueFields = computed(() => props.fields.filter((field) => !field.managed && field.type !== "boolean"));
const switchFields = computed(() => props.fields.filter((field) => !field.managed && field.type === "boolean"));
const managedFields = computed(() => props.fields.filter((field) => field.managed));

function errorFor(field: FirmwareFieldDto): string | undefined {
  return props.errors[`settings.${field.key}`] ?? props.errors[`meshtastic.settings.${field.key}`];
}
</script>

<template>
  <div>
    <SectionHeader :title="label" />

    <v-card v-if="valueFields.length > 0" class="pa-5 mb-4">
      <v-row dense>
        <v-col v-for="field in valueFields" :key="field.key" cols="12" lg="6">
          <FirmwareFieldInput
            v-model="settings[field.key]"
            :field="field"
            :enum-values="field.enum ? (enums[field.enum] ?? []) : []"
            :disabled="!editable"
            :error="errorFor(field)"
          />
        </v-col>
      </v-row>
    </v-card>

    <v-card v-if="switchFields.length > 0" class="mb-4">
      <v-list lines="two" class="py-0">
        <template v-for="(field, index) in switchFields" :key="field.key">
          <v-divider v-if="index > 0" />
          <v-list-item :title="field.label" :subtitle="field.description ?? ''">
            <template #append>
              <v-switch
                :model-value="settings[field.key] === true"
                :aria-label="field.label"
                :disabled="!editable"
                color="primary"
                hide-details
                inset
                @update:model-value="settings[field.key] = $event === true"
              />
            </template>
            <div v-if="errorFor(field)" class="text-caption text-error mt-1">{{ errorFor(field) }}</div>
          </v-list-item>
        </template>
      </v-list>
    </v-card>

    <v-card v-if="managedFields.length > 0" class="mb-4">
      <v-list lines="two" class="py-0">
        <template v-for="(field, index) in managedFields" :key="field.key">
          <v-divider v-if="index > 0" />
          <v-list-item :title="field.label" :subtitle="field.description ?? 'Set per member by OpenMeshTak.'">
            <template #append>
              <v-chip size="small" variant="tonal" label :prepend-icon="mdiLock">Managed</v-chip>
            </template>
          </v-list-item>
        </template>
      </v-list>
    </v-card>
  </div>
</template>
