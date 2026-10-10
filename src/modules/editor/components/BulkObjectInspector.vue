<script setup lang="ts">
import ColorInput from "./ColorInput.vue";
import { computed } from "vue";
import type { PackageLayerDto, PackageObjectDto, PackageObjectStyle } from "@/modules/data-packages/data-packages.api";
const props = defineProps<{ objects: PackageObjectDto[]; layers: PackageLayerDto[]; editable: boolean; saving: boolean }>();
const emit = defineEmits<{ style: [patch: Partial<PackageObjectStyle>]; remove: [] }>();
const locked = computed(() => props.objects.some((object) => props.layers.find(({ id }) => id === object.layerId)?.locked !== false));
const disabled = computed(() => !props.editable || props.saving || locked.value);
</script>
<template>
  <div class="pa-3 d-flex flex-column ga-3">
    <div class="text-title-small">{{ objects.length }} objects selected</div>
    <p class="text-body-small">Shift/Ctrl-click to add or remove objects within one package. Drag the selection to move it together. Each change is one undo step.</p>
    <v-alert v-if="locked" type="info" density="compact">A selected layer is locked. Unlock it or remove its objects from the selection.</v-alert>
    <label class="d-flex align-center ga-3">Colour <ColorInput label="Selection colour" :model-value="objects[0]?.style.color ?? '#1E88E5'" :disabled="disabled" @update:model-value="emit('style', { color: $event })" /></label>
    <v-slider :model-value="objects[0]?.style.strokeWidth ?? 3" label="Width" :min="1" :max="20" :step="1" thumb-label :disabled="disabled" hide-details @end="emit('style', { strokeWidth: $event })" />
    <v-select :model-value="objects[0]?.style.strokeStyle ?? 'solid'" label="Line style" :items="['solid', 'dashed', 'dotted']" :disabled="disabled" density="compact" hide-details @update:model-value="emit('style', { strokeStyle: $event })" />
    <v-btn v-if="editable" color="error" variant="tonal" :disabled="disabled" @click="emit('remove')">Delete selection</v-btn>
  </div>
</template>
