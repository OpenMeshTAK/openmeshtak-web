<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";

/** One group of an import preview, such as the changes or the values left out. Empty groups hide unless `empty` is set. */
defineProps<{
  title: string;
  items: Array<{ key: string; title: string; detail?: string }>;
  hint?: string;
  /** Marks a group of values the import leaves out with the orange (!). */
  warning?: boolean;
  empty?: string;
}>();
</script>

<template>
  <section v-if="items.length > 0 || empty" class="mb-4">
    <h3 class="text-title-small font-weight-medium d-flex align-center ga-1 mb-1">
      {{ title }} ({{ items.length }})
      <InfoHint v-if="hint" :text="hint" :tone="warning ? 'warning' : 'info'" :label="title" />
    </h3>
    <p v-if="items.length === 0" class="text-body-medium text-medium-emphasis my-0">{{ empty }}</p>
    <v-table v-else density="compact" class="preview-table">
      <tbody>
        <tr v-for="item in items" :key="item.key">
          <td>
            <div>{{ item.title }}</div>
            <div v-if="item.title !== item.key" class="text-body-small text-medium-emphasis">{{ item.key }}</div>
          </td>
          <td class="text-body-medium">{{ item.detail }}</td>
        </tr>
      </tbody>
    </v-table>
  </section>
</template>

<style scoped>
.preview-table td {
  vertical-align: top;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
  overflow-wrap: anywhere;
}
</style>
