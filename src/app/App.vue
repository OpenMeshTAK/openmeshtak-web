<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import StepUpHost from "@/modules/auth/StepUpHost.vue";
import { useLiveSession } from "@/modules/auth/useLiveSession";
import { instanceName, loadInstanceSettings } from "@/modules/instance-settings/instance-settings.api";
import { listSnapshots } from "@/modules/offline/offline-store";
import { coreConnection } from "@/shared/connection/core-connection";
import CoreConnectingScreen from "@/shared/connection/CoreConnectingScreen.vue";
import ToastHost from "@/shared/feedback/ToastHost.vue";
import VersionMismatchBar from "@/shared/version/VersionMismatchBar.vue";

const { connectionLost } = useLiveSession();
/** The offline HQ never needs Core, so no connection screen may cover it. */
const route = useRoute();
const offlineRoute = computed(() => route.meta.offline === true);
/** Whether this browser stores an event for the offline HQ, checked once Core does not answer. */
const offlineEvents = ref(false);
watch(
  () => coreConnection.waiting,
  (waiting) => {
    if (waiting) {
      listSnapshots()
        .then((snapshots) => (offlineEvents.value = snapshots.some(({ complete }) => complete)))
        .catch(() => (offlineEvents.value = false));
    }
  },
  { immediate: true },
);
/** The lost-connection overlay can be closed; a warning bar then stays until the connection is back. */
const lostDismissed = ref(false);
watch(connectionLost, (lost) => {
  if (!lost) {
    lostDismissed.value = false;
  }
});

watchEffect(() => {
  document.title = instanceName.value;
});

// The default name stays when Core is unreachable; pages report that themselves.
onMounted(() => {
  loadInstanceSettings().catch(() => undefined);
});
</script>

<template>
  <v-app>
    <template v-if="!offlineRoute">
      <CoreConnectingScreen v-if="coreConnection.waiting" :offline-available="offlineEvents" />
      <CoreConnectingScreen v-else-if="connectionLost && !lostDismissed" lost @dismiss="lostDismissed = true" />
    </template>
    <Teleport to="body">
      <v-theme-provider>
        <div v-if="connectionLost && lostDismissed && !offlineRoute" class="offline-notice text-body-medium" role="alert">
          <v-progress-circular indeterminate size="16" width="2" />
          No connection to the server. Changes cannot be saved until it is back.
        </div>
      </v-theme-provider>
    </Teleport>
    <VersionMismatchBar />
    <router-view />
    <ToastHost />
    <StepUpHost />
  </v-app>
</template>

<style scoped>
/* Floats above the page and open dialogs instead of covering the header; the page reconnects by itself. */
.offline-notice {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 8900;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 32px);
  padding: 8px 16px;
  border-radius: 999px;
  transform: translateX(-50%);
  color: rgb(var(--v-theme-on-warning));
  background: rgb(var(--v-theme-warning));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

@media (max-width: 599px) {
  .offline-notice {
    bottom: 96px;
  }
}
</style>
