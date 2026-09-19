<script setup lang="ts">
import { computed } from "vue";
import type { FirmwareFieldDto, SettingValue } from "../meshtastic-configuration.api";

/**
 * One profile field rendered from its definition. Constraints mirror the profile for quick
 * feedback only; Core validates every value again.
 */
const props = defineProps<{
  field: FirmwareFieldDto;
  enumValues: string[];
  disabled: boolean;
  error: string | undefined;
}>();
const value = defineModel<SettingValue | undefined>({ required: true });

const hint = computed(() =>
  [props.field.description, props.field.unit ? `Unit: ${props.field.unit}` : undefined].filter(Boolean).join(" · "),
);
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
    :hint="hint"
    :persistent-hint="Boolean(hint)"
    :disabled="disabled"
    :error-messages="errorMessages"
    color="primary"
    class="mb-2"
    @update:model-value="value = $event === true"
  />
  <v-select
    v-else-if="field.type === 'enum'"
    :model-value="typeof value === 'string' ? value : null"
    :items="enumValues"
    :label="field.label"
    :hint="hint"
    :persistent-hint="Boolean(hint)"
    :disabled="disabled"
    :error-messages="errorMessages"
    class="mb-2"
    @update:model-value="value = $event ?? undefined"
  />
  <v-text-field
    v-else-if="field.type === 'integer' || field.type === 'number'"
    :model-value="value === undefined ? '' : String(value)"
    :label="field.label"
    :hint="hint"
    :persistent-hint="Boolean(hint)"
    :suffix="field.unit ?? ''"
    :rules="numberRules"
    :disabled="disabled"
    :error-messages="errorMessages"
    type="number"
    class="mb-2"
    @update:model-value="updateNumber"
  />
  <v-text-field
    v-else
    :model-value="value === undefined ? '' : String(value)"
    :label="field.label"
    :hint="hint"
    :persistent-hint="Boolean(hint)"
    :counter="field.maxBytes ?? false"
    :disabled="disabled"
    :error-messages="errorMessages"
    class="mb-2"
    @update:model-value="value = $event"
  />
</template>
