<script setup lang="ts">
/** One on/off setting in the object inspector, laid out like the inspector's style rows. */
defineProps<{ label: string; modelValue: boolean; disabled?: boolean }>();
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <div class="inspector-toggle">
    <span class="inspector-toggle__label">{{ label }}</span>
    <v-switch
      :model-value="modelValue"
      :aria-label="label"
      :disabled="disabled"
      color="primary"
      inset
      density="compact"
      hide-details
      class="flex-grow-0"
      @update:model-value="$emit('update:modelValue', $event === true)"
    />
  </div>
</template>

<style scoped>
.inspector-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
}
.inspector-toggle__label {
  font-size: 0.8125rem;
}
.inspector-toggle :deep(.v-switch .v-selection-control) {
  min-height: 32px;
}
</style>
