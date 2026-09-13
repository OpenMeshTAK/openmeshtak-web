<script setup lang="ts">
import { useDisplay } from "vuetify";
import { useToastQueue } from "./toast";

const queue = useToastQueue();
const { smAndUp } = useDisplay();
</script>

<template>
  <!-- Bottom right on larger screens; centered above the floating bottom navigation on phones. -->
  <v-snackbar-queue
    v-model="queue"
    :location="smAndUp ? 'bottom end' : 'bottom'"
    closable
    close-text="Dismiss"
    content-class="omtk-toast"
  >
    <template #text="{ item }">
      <!-- Snackbars announce politely; errors use role="alert" so they are announced at once. -->
      <span :role="item.color === 'error' ? 'alert' : undefined">{{ item.text }}</span>
    </template>
  </v-snackbar-queue>
</template>

<!-- Not scoped: snackbars are teleported overlays, so scoped selectors never reach them. The queue
     forwards only snackbar props, hence `content-class` instead of `class`. -->
<style>
@media (max-width: 599px) {
  .v-snackbar .omtk-toast {
    margin-bottom: 96px;
  }
}
</style>
