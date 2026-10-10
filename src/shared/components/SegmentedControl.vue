<script setup lang="ts" generic="T extends string | number">
/** Joined options with one outer border, so touching edges are never rounded. */
defineProps<{ modelValue: T; options: ReadonlyArray<{ title: string; value: T }>; label: string; disabled?: boolean }>();
defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="label">
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
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 8px;
  overflow: hidden;
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
.segmented__option + .segmented__option {
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.24);
}
.segmented__option:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.segmented__option--active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.16);
}
.segmented__option:disabled {
  cursor: default;
  opacity: 0.5;
}
</style>
