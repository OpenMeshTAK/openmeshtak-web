<script setup lang="ts">
import { mdiAlert, mdiAlertCircle, mdiCheckCircle, mdiClose, mdiInformation } from "@mdi/js";
import { useDisplay } from "vuetify";
import { type ToastKind, useToastQueue } from "./toast";

const queue = useToastQueue();
const { smAndUp } = useDisplay();

const kinds: Record<ToastKind, { icon: string; title: string }> = {
  success: { icon: mdiCheckCircle, title: "Success" },
  info: { icon: mdiInformation, title: "Information" },
  warning: { icon: mdiAlert, title: "Warning" },
  error: { icon: mdiAlertCircle, title: "Error" },
};
</script>

<template>
  <!-- Bottom right on larger screens; centered above the floating bottom navigation on phones.
       Up to five toasts stack collapsed behind the newest one and fan out on hover; further ones
       wait instead of pushing out unread errors. `slide-auto` slides in from the toast's edge. -->
  <v-snackbar-queue
    v-model="queue"
    :location="smAndUp ? 'bottom end' : 'bottom'"
    :total-visible="5"
    display-strategy="hold"
    collapsed
    transition="slide-auto"
    closable
    close-text="Dismiss"
    color="surface"
    rounded="lg"
    content-class="omtk-toast"
  >
    <template #header="{ item }">
      <div class="d-flex align-center ga-2 ps-4 pe-12 pt-3 text-title-small">
        <v-icon :icon="kinds[item.kind].icon" :color="item.kind" size="20" />
        <span>{{ kinds[item.kind].title }}</span>
      </div>
    </template>
    <template #text="{ item }">
      <!-- Snackbars announce politely; errors use role="alert" so they are announced at once. -->
      <div :role="item.kind === 'error' ? 'alert' : undefined">{{ item.text }}</div>
    </template>
    <template #actions="{ item, props }">
      <v-btn v-if="item.action" variant="text" color="primary" @click="item.action.run()">{{ item.action.label }}</v-btn>
      <!-- The header slot gets no dismiss handler, so the close button stays here and CSS moves it
           into the header row. -->
      <v-btn v-bind="props" :icon="mdiClose" variant="text" size="small" aria-label="Dismiss" class="omtk-toast__close" />
    </template>
  </v-snackbar-queue>
</template>

<!-- Not scoped: snackbars are teleported overlays, so scoped selectors never reach them. The queue
     forwards only snackbar props, hence `content-class` instead of `class`. -->
<style>
.v-snackbar .omtk-toast {
  position: relative;
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.v-snackbar .omtk-toast__close {
  position: absolute;
  top: 4px;
  inset-inline-end: 4px;
}

@media (max-width: 599px) {
  .v-snackbar .omtk-toast {
    margin-bottom: 96px;
  }
}
</style>
