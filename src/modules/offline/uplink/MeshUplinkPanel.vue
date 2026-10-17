<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { formatAge } from "../format-age";
import { HQ_NAME_MAX } from "./hq-identity";
import { OUTBOX_MAX_AGE_MS, OUTBOX_MAX_ENTRIES } from "./uplink-outbox";
import type { UplinkAccess, useMeshUplink } from "./useMeshUplink";

/**
 * The uplink part of the Offline HQ panel: the switch, the HQ name and what happened to the
 * observations so far. Errors stay visible; explanations sit behind the (?) buttons.
 */
const props = defineProps<{ uplink: ReturnType<typeof useMeshUplink>; eventId: string; now: Date; online: boolean }>();

const status = computed(() => props.uplink.status.value);
const enabled = computed(() => props.uplink.enabled.value);
const hqName = ref(props.uplink.hq.value.name);
const confirmOff = ref(false);
const confirmClear = ref(false);
const busy = ref(false);
const signInLink = computed(() => ({ name: "sign-in", query: { redirect: `/offline/${props.eventId}` } }));
const outboxLimits = `The outbox keeps at most ${OUTBOX_MAX_ENTRIES.toLocaleString()} observations for at most ${String(OUTBOX_MAX_AGE_MS / 3_600_000)} hours; older ones are dropped.`;

watch(() => props.uplink.hq.value.name, (name) => (hqName.value = name));

const unavailableText = computed(() => {
  if (enabled.value) return null;
  if (!props.online) return "Needs a network connection to OpenMeshTak.";
  const texts: Record<UplinkAccess, string | null> = {
    "signed-out": "Sign in to forward what this radio hears.",
    denied: "You may not forward mesh positions for this event.",
    unknown: "OpenMeshTak is not reachable yet.",
    allowed: null,
  };
  return texts[props.uplink.access.value];
});

const retryText = computed(() => {
  const retryAt = status.value.retryAt;
  if (retryAt === null) return null;
  const seconds = Math.max(0, Math.ceil((retryAt - props.now.getTime()) / 1000));
  return `Next attempt in ${String(seconds)} s`;
});

async function toggle(on: boolean | null): Promise<void> {
  if (on === true) {
    await props.uplink.enable();
  } else if (status.value.queued > 0) {
    confirmOff.value = true;
  } else {
    await props.uplink.disable();
  }
}

async function switchOff(): Promise<void> {
  busy.value = true;
  await props.uplink.disable();
  busy.value = false;
  confirmOff.value = false;
}

async function clearOutbox(): Promise<void> {
  busy.value = true;
  await props.uplink.clear();
  busy.value = false;
  confirmClear.value = false;
}

function saveName(): void {
  if (hqName.value !== props.uplink.hq.value.name) props.uplink.renameHq(hqName.value);
}
</script>

<template>
  <div>
    <div class="d-flex align-center px-3 pt-3 pb-1">
      <div class="text-title-small flex-grow-1">
        Uplink to OpenMeshTak
        <InfoHint
          label="About the uplink"
          text="Forwards the positions and node names this radio hears, so the event's live view shows them and, while the event records, its history keeps them. They are never sent to TAK apps. While the network is gone, observations wait in this browser and are sent in order once it returns."
        />
      </div>
    </div>
    <div class="px-3 pb-3">
      <v-switch
        :model-value="enabled"
        :disabled="!enabled && !uplink.canEnable.value"
        label="Forward to OpenMeshTak"
        color="primary"
        density="compact"
        hide-details
        inset
        @update:model-value="toggle"
      />
      <p v-if="unavailableText !== null" class="text-body-small text-medium-emphasis my-1">
        {{ unavailableText }}
        <router-link v-if="online && uplink.access.value === 'signed-out'" :to="signInLink">Sign in</router-link>
      </p>
      <v-text-field
        v-model="hqName"
        label="HQ name"
        :maxlength="HQ_NAME_MAX"
        placeholder="e.g. HQ North"
        density="compact"
        hide-details
        class="mt-2"
        @blur="saveName"
        @keydown.enter="saveName"
      >
        <template #append-inner>
          <InfoHint label="About the HQ name" text="Viewers see it next to the positions this HQ forwards, so several HQs can be told apart. It is stored in this browser." />
        </template>
      </v-text-field>

      <template v-if="enabled || status.queued > 0">
        <div class="uplink-counts text-body-small mt-3">
          <span>Queued</span><span>{{ status.queued }}</span>
          <span>Sent</span>
          <span>
            {{ status.sent }}
            <template v-if="status.duplicates + status.takPreferred > 0">
              ({{ status.duplicates }} already received, {{ status.takPreferred }} covered by TAK)
            </template>
          </span>
          <span>Rejected</span><span>{{ status.rejected }}</span>
          <template v-if="status.dropped > 0">
            <span>Dropped</span>
            <span>
              {{ status.dropped }}
              <InfoHint tone="warning" label="Dropped observations" :text="outboxLimits" />
            </span>
          </template>
        </div>
        <p class="text-body-small text-medium-emphasis mt-1 mb-0">
          <template v-if="status.lastSentAt !== null">Last sent {{ formatAge(new Date(status.lastSentAt), now) }}</template>
          <template v-else>Nothing sent yet</template>
          <template v-if="retryText !== null"> · {{ retryText }}</template>
        </p>
        <v-alert v-if="status.lastError !== null" type="error" density="compact" class="mt-2">{{ status.lastError }}</v-alert>
        <v-alert v-if="uplink.outboxError.value !== null" type="error" density="compact" class="mt-2">{{ uplink.outboxError.value }}</v-alert>
        <div class="d-flex align-center ga-1 mt-2">
          <v-btn size="small" variant="tonal" :disabled="status.queued === 0" @click="confirmClear = true">Clear outbox</v-btn>
          <InfoHint label="About the outbox" :text="`Unsent observations of this event wait in this browser while the uplink is on. ${outboxLimits} Switching the uplink off deletes them.`" />
        </div>
      </template>
    </div>

    <ConfirmDialog v-model="confirmOff" title="Switch the uplink off?" confirm-label="Switch off" confirm-color="error" :loading="busy" @confirm="switchOff">
      {{ status.queued }} observations have not been sent yet. Switching off deletes them from this browser; OpenMeshTak will never receive them.
    </ConfirmDialog>
    <ConfirmDialog v-model="confirmClear" title="Clear the outbox?" confirm-label="Clear outbox" confirm-color="error" :loading="busy" @confirm="clearOutbox">
      {{ status.queued }} observations that have not been sent yet are deleted from this browser. OpenMeshTak will never receive them.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.uplink-counts {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  row-gap: 2px;
}
</style>
