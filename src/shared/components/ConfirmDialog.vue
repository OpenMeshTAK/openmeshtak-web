<script setup lang="ts">
/**
 * Explicit confirmation for consequential actions. The consequence text is mandatory so a
 * destructive action never hides what it does behind a generic "Are you sure?".
 */
defineProps<{
  title: string;
  confirmLabel: string;
  confirmColor?: string;
  loading?: boolean;
  /** Wider dialogs suit consequences that list several items. */
  maxWidth?: number;
}>();
const open = defineModel<boolean>({ required: true });
defineEmits<{ confirm: [] }>();
</script>

<template>
  <v-dialog v-model="open" :max-width="maxWidth ?? 520">
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-medium text-wrap">{{ title }}</v-card-title>
      <v-card-text class="text-body-medium"><slot /></v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="open = false">Cancel</v-btn>
        <v-btn :color="confirmColor ?? 'primary'" :loading="loading" @click="$emit('confirm')">
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
