<script setup lang="ts">
defineProps<{ message: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <v-alert type="error" role="alert" class="my-4">
    <div>{{ message }}</div>
    <v-btn class="mt-3" variant="outlined" size="small" @click="$emit('retry')">Try again</v-btn>
  </v-alert>
</template>
