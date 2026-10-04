<script setup lang="ts">
import type { Schemas } from "@/shared/api/types";

defineProps<{ status: Schemas["ApiClientStatus"] }>();
</script>

<template>
  <v-chip :color="status === 'active' ? 'success' : 'secondary'" size="small" variant="tonal" label>
    {{ status === "active" ? "Active" : "Disabled" }}
  </v-chip>
</template>
