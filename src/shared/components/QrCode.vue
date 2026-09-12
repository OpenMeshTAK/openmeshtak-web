<script setup lang="ts">
import qrcode from "qrcode-generator";
import { computed } from "vue";

const props = defineProps<{ value: string; label: string; size?: number }>();

/**
 * Renders the QR matrix as one SVG path from data, so no generated markup is injected as HTML.
 * The value may be a secret (claim link); it is never logged and lives only in the parent's memory.
 */
const matrix = computed(() => {
  const code = qrcode(0, "M");
  code.addData(props.value);
  code.make();
  const count = code.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (code.isDark(row, column)) {
        path += `M${String(column)},${String(row)}h1v1h-1z`;
      }
    }
  }
  return { count, path };
});
</script>

<template>
  <svg
    :viewBox="`-4 -4 ${matrix.count + 8} ${matrix.count + 8}`"
    :width="size ?? 220"
    :height="size ?? 220"
    role="img"
    :aria-label="label"
    shape-rendering="crispEdges"
    style="background: #fff; border-radius: 8px"
  >
    <path :d="matrix.path" fill="#000" />
  </svg>
</template>
