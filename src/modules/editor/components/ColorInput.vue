<script setup lang="ts">
defineProps<{ modelValue: string; label: string; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <input
    type="color"
    class="color-input"
    :value="modelValue.toLowerCase()"
    :disabled="disabled"
    :aria-label="label"
    @change="emit('update:modelValue', ($event.target as HTMLInputElement).value.toUpperCase())"
  >
</template>

<style scoped>
.color-input {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  overflow: hidden;
}
.color-input:disabled {
  cursor: default;
  opacity: 0.5;
}
.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.color-input::-webkit-color-swatch {
  border: none;
}
.color-input::-moz-color-swatch {
  border: none;
}
</style>
