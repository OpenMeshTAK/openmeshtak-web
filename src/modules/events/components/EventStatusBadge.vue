<script setup lang="ts">
import { computed } from "vue";
import type { Schemas } from "@/shared/api/types";

const props = defineProps<{ status: Schemas["EventStatus"] }>();

// Status is spelled out in text so it never depends on color alone.
const appearance = computed(
  () =>
    ({
      draft: { color: "warning", label: "Draft" },
      active: { color: "success", label: "Active" },
      archived: { color: "secondary", label: "Archived" },
    })[props.status],
);
</script>

<template>
  <v-chip :color="appearance.color" size="small" variant="tonal" label>{{ appearance.label }}</v-chip>
</template>
