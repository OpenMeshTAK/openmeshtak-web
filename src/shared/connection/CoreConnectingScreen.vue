<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import AppLogo from "@/shared/components/AppLogo.vue";
import { coreConnection } from "./core-connection";

/**
 * Shown while Core does not answer. On start (`lost` false) it covers the empty app. When the
 * live connection breaks during work (`lost` true) it blurs the page underneath and can be
 * closed to keep reading; the app then shows a warning bar until the connection is back.
 */
defineProps<{
  lost?: boolean;
  /** Offers the offline HQ, which works without the server, when this browser stores an event for it. */
  offlineAvailable?: boolean;
}>();
const emit = defineEmits<{ dismiss: [] }>();
</script>

<template>
  <!-- Vuetify teleports dialogs to the body with z-indexes from 2000 up; this must cover them too. -->
  <Teleport to="body">
    <v-theme-provider>
      <div class="connecting" :class="{ 'connecting--lost': lost }" role="status" aria-live="polite">
        <v-btn
          v-if="lost"
          class="connecting__close"
          :icon="mdiClose"
          variant="text"
          aria-label="Continue without a connection"
          title="Continue without a connection"
          @click="emit('dismiss')"
        />
        <AppLogo v-if="!lost" :size="56" class="mb-8" />
        <v-progress-circular indeterminate color="primary" size="44" width="4" class="mb-6" />
        <div class="text-title-large mb-2 text-center">{{ lost ? "The connection to the server was lost" : "Connecting to the server…" }}</div>
        <div class="text-body-medium text-medium-emphasis text-center connecting__text">
          <template v-if="lost">Reconnecting… What you already saved is safe. This page continues by itself as soon as the server answers.</template>
          <template v-else>OpenMeshTak is starting or briefly unreachable. This page continues by itself as soon as it answers.</template>
          <template v-if="coreConnection.attempts > 3"><br>Still trying ({{ coreConnection.attempts }} attempts).</template>
        </div>
        <v-btn v-if="offlineAvailable" to="/offline" variant="tonal" class="mt-6">Open offline HQ</v-btn>
      </div>
    </v-theme-provider>
  </Teleport>
</template>

<style scoped>
.connecting {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(var(--v-theme-background));
}

/* During work the page stays visible but out of reach, so nobody edits into a dead connection. */
.connecting--lost {
  background: rgba(var(--v-theme-background), 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.connecting__close {
  position: absolute;
  top: 16px;
  right: 16px;
}

.connecting__text {
  max-width: 440px;
}
</style>
