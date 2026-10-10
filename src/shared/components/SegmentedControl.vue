<script setup lang="ts" generic="T extends string | number">
/** Joined options with one outer border, so touching edges are never rounded. */
withDefaults(
  defineProps<{
    modelValue: T;
    options: ReadonlyArray<{ title: string; value: T }>;
    label: string;
    disabled?: boolean;
    /** `default` matches the height of buttons and fields; `small` fits compact panels such as the editor. */
    size?: "small" | "default";
    /** Sizes to its options instead of filling the row. */
    inline?: boolean;
  }>(),
  { disabled: false, size: "small", inline: false },
);
defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<template>
  <div
    class="segmented"
    :class="{ 'segmented--default': size === 'default', 'segmented--inline': inline }"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      class="segmented__option"
      :class="{ 'segmented__option--active': modelValue === option.value }"
      :aria-checked="modelValue === option.value"
      :disabled="disabled"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.title }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  flex: 1 1 auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
}
.segmented--inline {
  display: inline-flex;
  flex: 0 0 auto;
  max-width: 100%;
}
.segmented__option {
  flex: 1 1 0;
  min-width: 0;
  appearance: none;
  border: none;
  border-radius: 0;
  padding: 4px 6px;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: inherit;
  background: none;
  cursor: pointer;
}
.segmented--default .segmented__option {
  flex: 1 0 auto;
  min-height: 36px;
  padding: 6px 16px;
  font-size: 0.875rem;
  font-weight: 500;
}
.segmented__option + .segmented__option {
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.segmented__option:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.segmented__option:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.segmented__option--active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.16);
}
.segmented__option--active:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.22);
}
.segmented__option:disabled {
  cursor: default;
  opacity: 0.5;
}
</style>
