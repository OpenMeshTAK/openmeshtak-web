<script setup lang="ts">
import { ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";
type Ellipse = Extract<PackageGeometry, { type: "Ellipse" }>;
const props = defineProps<{ geometry: Ellipse; disabled: boolean }>();
const emit = defineEmits<{ change: [geometry: Ellipse] }>();
const major = ref("");
const minor = ref("");
const rotation = ref("");
const error = ref("");
watch(() => props.geometry, (geometry) => {
  major.value = String(geometry.major);
  minor.value = String(geometry.minor);
  rotation.value = String(geometry.rotation);
  error.value = "";
}, { immediate: true });
function commit(): void {
  if (props.disabled) return;
  const a = Number(major.value);
  const b = Number(minor.value);
  const angle = Number(rotation.value);
  if (![major.value, minor.value, rotation.value].every((value) => value.trim() !== "") || ![a, b, angle].every(Number.isFinite)
    || b < 0.1 || a < b || a > 100000 || angle < 0 || angle > 360) {
    error.value = "Enter axes between 0.1 and 100000 m (minor ≤ major) and rotation between 0° and 360°.";
    return;
  }
  error.value = "";
  if (a !== props.geometry.major || b !== props.geometry.minor || angle !== props.geometry.rotation) emit("change", { ...props.geometry, major: a, minor: b, rotation: angle });
}
</script>
<template>
  <div class="text-label-medium text-uppercase text-medium-emphasis mb-3">Ellipse</div>
  <v-text-field v-model="major" label="Major semi-axis (m)" density="compact" :disabled="disabled" @blur="commit" @keydown.enter="commit">
    <template #append-inner><InfoHint label="About ellipse axes" text="Axes are distances from the centre to the edge. Drag the major, minor or rotation handle on the map to adjust the ellipse." /></template>
  </v-text-field>
  <v-text-field v-model="minor" label="Minor semi-axis (m)" density="compact" :disabled="disabled" @blur="commit" @keydown.enter="commit" />
  <v-text-field v-model="rotation" label="Rotation (° clockwise from north)" density="compact" :disabled="disabled" @blur="commit" @keydown.enter="commit" />
  <v-alert v-if="error" type="error" density="compact">{{ error }}</v-alert>
</template>
