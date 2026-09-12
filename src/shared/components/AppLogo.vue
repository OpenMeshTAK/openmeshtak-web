<script setup lang="ts">
defineProps<{ size?: number }>();
</script>

<template>
  <!-- Three linked mesh nodes. Uses the theme's primary color, never a hard-coded brand color. -->
  <svg :width="size ?? 32" :height="size ?? 32" viewBox="0 0 32 32" role="img" aria-label="OpenMeshTak">
    <g fill="none" stroke="rgb(var(--v-theme-primary))" stroke-width="2.4" stroke-linecap="round">
      <path d="M8 23 L16 8 L24 23 Z" opacity="0.55" />
    </g>
    <g fill="rgb(var(--v-theme-primary))">
      <circle cx="16" cy="8" r="4" />
      <circle cx="8" cy="23" r="4" />
      <circle cx="24" cy="23" r="4" />
    </g>
  </svg>
</template>
