<script setup lang="ts">
import { mdiRestore } from "@mdi/js";
import { computed } from "vue";
import type { AtakCatalogKeyDto, AtakPreferenceEntryDto } from "./tak-configuration.api";

/**
 * Edits one ATAK preference value the way ATAK stores it: a list of the catalog's values, on/off for
 * booleans, or text. `null` means the event sends nothing for this key, which leaves the device as
 * it is; "Reset to ATAK default" sends ATAK's own default instead.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    label: string;
    /** The catalog entry of a known key; `null` for plugin and other keys. */
    definition: AtakCatalogKeyDto | null;
    type: AtakPreferenceEntryDto["type"];
    errorMessages?: string[];
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  { errorMessages: () => [], disabled: false, clearable: true },
);
const emit = defineEmits<{ "update:modelValue": [value: string | null] }>();

/** Stands for "send nothing" in lists and button groups, which cannot hold `null`. */
const NOT_SET = "not-set";
const choices = computed(() =>
  props.definition?.values
    ? props.definition.values.map(({ value, label }) => ({ value, title: label === value ? value : `${label} (${value})` }))
    : null,
);
/** "Not set" is the list's first entry where the value may be left out. */
const items = computed(() => (props.clearable ? [{ value: NOT_SET, title: "Not set" }, ...(choices.value ?? [])] : (choices.value ?? [])));
/** On/off settings get three buttons; "Not set" leaves the device's own choice alone. */
const toggle = computed(() => choices.value === null && props.type === "boolean");
const numeric = computed(() => props.definition?.numeric === true || ["integer", "long", "float"].includes(props.type));
const defaultValue = computed(() => props.definition?.defaultValue ?? null);
const canReset = computed(
  () => !props.disabled && props.modelValue !== null && defaultValue.value !== null && props.modelValue !== defaultValue.value,
);
const defaultTitle = computed(() =>
  toggle.value
    ? defaultValue.value === "true"
      ? "On"
      : "Off"
    : (choices.value?.find(({ value }) => value === defaultValue.value)?.title ?? defaultValue.value),
);

function update(value: string | null | undefined): void {
  emit("update:modelValue", value === undefined || value === null || value === NOT_SET ? null : String(value));
}
</script>

<template>
  <div class="d-flex align-center ga-1 flex-grow-1">
    <div v-if="toggle" class="d-flex flex-column flex-grow-1 align-end">
      <v-btn-toggle
        :model-value="modelValue ?? NOT_SET"
        :aria-label="label"
        :disabled="disabled"
        density="compact"
        variant="text"
        divided
        mandatory
        rounded="lg"
        class="value-toggle"
        @update:model-value="update"
      >
        <v-btn value="false" rounded="0" :class="{ 'value-toggle__off': modelValue === 'false' }">Off</v-btn>
        <v-btn v-if="clearable" :value="NOT_SET" rounded="0">Not set</v-btn>
        <v-btn value="true" rounded="0" :class="{ 'value-toggle__on': modelValue === 'true' }">On</v-btn>
      </v-btn-toggle>
      <div v-for="message in errorMessages" :key="message" class="text-body-small text-error mt-1">{{ message }}</div>
    </div>
    <v-select
      v-else-if="choices !== null"
      :model-value="modelValue ?? (clearable ? NOT_SET : null)"
      :items="items"
      :aria-label="label"
      density="compact"
      :disabled="disabled"
      :error-messages="errorMessages"
      :hide-details="errorMessages.length === 0"
      @update:model-value="update"
    />
    <v-text-field
      v-else
      :model-value="modelValue ?? ''"
      :aria-label="label"
      density="compact"
      placeholder="Not set"
      :inputmode="numeric ? 'decimal' : undefined"
      :disabled="disabled"
      :error-messages="errorMessages"
      :hide-details="errorMessages.length === 0"
      @update:model-value="update($event === '' && clearable ? null : $event)"
    />
    <!-- Always present for known keys, so rows line up; usable when the value differs from ATAK's. -->
    <v-btn
      v-if="definition !== null"
      :icon="mdiRestore"
      :disabled="!canReset"
      variant="text"
      size="small"
      :aria-label="defaultValue === null ? `ATAK sets no default for ${label}` : `Reset ${label} to the ATAK default ${defaultTitle}`"
      :title="defaultValue === null ? 'ATAK sets no default' : `Reset to the ATAK default: ${defaultTitle}`"
      @click="update(defaultValue)"
    />
  </div>
</template>

<style scoped>
/* One shape for the whole group: only its outer corners are round, the buttons inside are square. */
.value-toggle {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
/* Solid, darker colours with white text read better than the theme's light error and primary tints. */
.value-toggle.v-btn-group .v-btn.value-toggle__off {
  background: #b3261e;
  color: #fff;
}
.value-toggle.v-btn-group .v-btn.value-toggle__on {
  background: #1f5fbf;
  color: #fff;
}
</style>
