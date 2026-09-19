<script setup lang="ts">
import type { FirmwareFieldDto, SettingValue } from "../meshtastic-configuration.api";
import FirmwareFieldInput from "./FirmwareFieldInput.vue";

/** One profile section such as LoRa, rendered only from the profile's field definitions. */
defineProps<{
  label: string;
  fields: FirmwareFieldDto[];
  enums: Record<string, string[]>;
  editable: boolean;
  errors: Record<string, string>;
}>();
const settings = defineModel<Record<string, SettingValue | undefined>>({ required: true });
</script>

<template>
  <div>
    <div class="text-h6 mb-4">{{ label }}</div>
    <template v-for="field in fields" :key="field.key">
      <v-text-field
        v-if="field.managed"
        :model-value="'Set per member by OpenMeshTak'"
        :label="field.label"
        :hint="field.description"
        :persistent-hint="Boolean(field.description)"
        readonly
        disabled
        class="mb-2"
      />
      <FirmwareFieldInput
        v-else
        v-model="settings[field.key]"
        :field="field"
        :enum-values="field.enum ? (enums[field.enum] ?? []) : []"
        :disabled="!editable"
        :error="errors[`settings.${field.key}`] ?? errors[`meshtastic.settings.${field.key}`]"
      />
    </template>
  </div>
</template>
