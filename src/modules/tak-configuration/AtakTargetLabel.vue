<script setup lang="ts">
import type { TargetOption } from "./tak-settings";

/** A target as a badge for its kind, followed by its name and, for members, their group. */
defineProps<{ target: Pick<TargetOption, "kind" | "name" | "detail"> }>();

const COLORS: Record<TargetOption["kind"], string | undefined> = {
  Event: undefined,
  Group: "primary",
  Role: "secondary",
  Member: "info",
};
</script>

<template>
  <span class="d-inline-flex align-center ga-2 text-no-wrap">
    <v-chip size="x-small" label variant="tonal" :color="COLORS[target.kind]" class="target-kind">{{ target.kind }}</v-chip>
    <span>{{ target.name }}</span>
    <span v-if="target.detail" class="text-medium-emphasis">{{ target.detail }}</span>
  </span>
</template>

<style scoped>
.target-kind {
  min-width: 56px;
  justify-content: center;
}
</style>
