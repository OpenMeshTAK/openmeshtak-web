<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { computed } from "vue";
import type { FirmwareEnumValueDto, FirmwareFieldDto, SettingValue } from "../meshtastic-configuration.api";

/**
 * One profile field rendered from its definition. Constraints mirror the profile for quick
 * feedback only; Core validates every value again.
 */
const props = defineProps<{
  field: FirmwareFieldDto;
  enumValues: FirmwareEnumValueDto[];
  disabled: boolean;
  error: string | undefined;
}>();
const value = defineModel<SettingValue | undefined>({ required: true });

// Number fields already show their unit as a suffix.
const hint = computed(() => props.field.description ?? "");
const errorMessages = computed(() => (props.error === undefined ? [] : [props.error]));

const numberRules = computed(() => [
  (input: unknown) => {
    const number = Number(input);
    const { min, max, type } = props.field;
    if (Number.isNaN(number) || (type === "integer" && !Number.isInteger(number))) {
      return type === "integer" ? "Use a whole number." : "Use a number.";
    }
    if ((min !== undefined && number < min) || (max !== undefined && number > max)) {
      return `Use a value from ${String(min)} to ${String(max)}.`;
    }
    return true;
  },
]);

function updateNumber(input: string): void {
  value.value = input === "" ? undefined : Number(input);
}
</script>

<template>
  <v-switch
    v-if="field.type === 'boolean'"
    :model-value="value === true"
    :label="field.label"
    :disabled="disabled"
    :error-messages="errorMessages"
    color="primary"
    class="mb-2"
    @update:model-value="value = $event === true"
  >
    <template v-if="hint" #append>
      <InfoHint :label="`About ${field.label.toLowerCase()}`" :text="hint" />
    </template>
  </v-switch>
  <v-select
    v-else-if="field.type === 'enum'"
    :model-value="typeof value === 'string' ? value : null"
    :items="enumValues"
    item-title="label"
    item-value="value"
    :label="field.label"
    :disabled="disabled"
    :error-messages="errorMessages"
    class="mb-2"
    @update:model-value="value = $event ?? undefined"
  >
    <template v-if="hint" #append-inner>
      <InfoHint :label="`About ${field.label.toLowerCase()}`" :text="hint" />
    </template>
  </v-select>
  <v-text-field
    v-else-if="field.type === 'integer' || field.type === 'number'"
    :model-value="value === undefined ? '' : String(value)"
    :label="field.label"
    :suffix="field.unit ?? ''"
    :rules="numberRules"
    :disabled="disabled"
    :error-messages="errorMessages"
    type="number"
    class="mb-2"
    @update:model-value="updateNumber"
  >
    <template v-if="hint" #append-inner>
      <InfoHint :label="`About ${field.label.toLowerCase()}`" :text="hint" />
    </template>
  </v-text-field>
  <v-text-field
    v-else
    :model-value="value === undefined ? '' : String(value)"
    :label="field.label"
    :counter="field.maxBytes ?? false"
    :disabled="disabled"
    :error-messages="errorMessages"
    class="mb-2"
    @update:model-value="value = $event"
  >
    <template v-if="hint" #append-inner>
      <InfoHint :label="`About ${field.label.toLowerCase()}`" :text="hint" />
    </template>
  </v-text-field>
</template>
