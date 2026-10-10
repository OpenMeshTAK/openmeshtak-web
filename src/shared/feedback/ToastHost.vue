<script setup lang="ts">
import { mdiAlert, mdiAlertCircle, mdiCheckCircle, mdiInformation } from "@mdi/js";
import { useDisplay } from "vuetify";
import { type ToastKind, useToastQueue } from "./toast";

const queue = useToastQueue();
const { smAndUp } = useDisplay();

const icons: Record<ToastKind, string> = {
  success: mdiCheckCircle,
  info: mdiInformation,
  warning: mdiAlert,
  error: mdiAlertCircle,
};
</script>

<template>
  <!-- Bottom right on larger screens; centered above the floating bottom navigation on phones.
       Up to three toasts stack; further ones wait instead of pushing out unread errors. -->
  <v-snackbar-queue
    v-model="queue"
    :location="smAndUp ? 'bottom end' : 'bottom'"
    :total-visible="3"
    display-strategy="hold"
    closable
    close-text="Dismiss"
    color="surface"
    rounded="lg"
    content-class="omtk-toast"
  >
    <template #text="{ item }">
      <!-- Snackbars announce politely; errors use role="alert" so they are announced at once. -->
      <div class="d-flex align-center ga-3" :role="item.kind === 'error' ? 'alert' : undefined">
        <v-icon :icon="icons[item.kind]" :color="item.kind" size="20" />
        <span>{{ item.text }}</span>
      </div>
    </template>
    <template #actions="{ item, props }">
      <v-btn v-if="item.action" variant="text" color="primary" @click="item.action.run()">{{ item.action.label }}</v-btn>
      <v-btn v-bind="props" variant="text">Dismiss</v-btn>
    </template>
  </v-snackbar-queue>
</template>

<!-- Not scoped: snackbars are teleported overlays, so scoped selectors never reach them. The queue
     forwards only snackbar props, hence `content-class` instead of `class`. -->
<style>
.v-snackbar .omtk-toast {
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

@media (max-width: 599px) {
  .v-snackbar .omtk-toast {
    margin-bottom: 96px;
  }
}
</style>
