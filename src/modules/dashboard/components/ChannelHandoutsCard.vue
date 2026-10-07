<script setup lang="ts">
import { mdiContentCopy, mdiOpenInNew, mdiQrcode } from "@mdi/js";
import { computed, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import type { Schemas } from "@/shared/api/types";
import QrCode from "@/shared/components/QrCode.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { fetchChannelHandout } from "../dashboard.api";

const props = defineProps<{
  eventId: string;
  memberId: string;
  channels: Schemas["ProfileChannel"][];
}>();

const toast = useToast();
const { xs } = useDisplay();
const holderChannels = computed(() => props.channels.filter(({ keyHolder }) => keyHolder));
const dialogOpen = ref(false);
const selected = ref<Schemas["ProfileChannel"] | null>(null);
const handout = ref<Schemas["ChannelHandoutDto"] | null>(null);
const loading = ref(false);
const error = ref("");

async function load(): Promise<void> {
  if (selected.value === null) return;
  loading.value = true;
  error.value = "";
  handout.value = null;
  try {
    handout.value = await fetchChannelHandout(props.eventId, props.memberId, selected.value.id);
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    loading.value = false;
  }
}

function open(channel: Schemas["ProfileChannel"]): void {
  selected.value = channel;
  dialogOpen.value = true;
  void load();
}

async function copyLink(): Promise<void> {
  if (handout.value === null) return;
  try {
    await navigator.clipboard.writeText(handout.value.url);
    toast.success("Channel link copied.");
  } catch {
    toast.error("The channel link could not be copied.");
  }
}

watch(dialogOpen, (open) => {
  if (!open) {
    // The URL fragment contains the PSK; release it as soon as the explicit reveal closes.
    selected.value = null;
    handout.value = null;
    error.value = "";
  }
});
</script>

<template>
  <v-card v-if="holderChannels.length > 0" class="pa-5">
    <div class="d-flex align-center ga-2 mb-1">
      <v-icon :icon="mdiQrcode" color="warning" />
      <div class="text-title-medium font-weight-medium">Secret channel handouts</div>
      <InfoHint
        label="About key holders"
        text="You are a key holder. Open a handout only when you are ready to share that channel on site."
      />
    </div>
    <v-list lines="two" density="compact" class="pa-0">
      <v-list-item v-for="channel in holderChannels" :key="channel.id" class="px-0">
        <v-list-item-title>{{ channel.name }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ channel.primary ? "Primary channel" : "Secondary channel" }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn size="small" variant="tonal" color="warning" @click="open(channel)">
            Show QR
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-card>

  <v-dialog v-model="dialogOpen" max-width="560" :fullscreen="xs">
    <v-card>
      <v-card-title>Handout for {{ selected?.name }}</v-card-title>
      <v-card-text>
        <v-skeleton-loader v-if="loading" type="image, text" />
        <v-alert v-else-if="error" type="error" variant="tonal">
          {{ error }}
          <template #append><v-btn variant="text" size="small" @click="load">Retry</v-btn></template>
        </v-alert>
        <div v-else-if="handout" class="d-flex flex-column align-center ga-4">
          <v-alert type="warning" variant="tonal" density="compact">
            This QR code and link contain the channel key. Share them only with the intended
            participants. Key rotation makes this handout obsolete. This handout carries only this
            channel, not the event's complete radio setup.
          </v-alert>
          <p v-if="handout.primary" class="text-body-medium text-medium-emphasis my-0">
            This is the primary channel. Its standard Meshtastic link uses replacement semantics;
            review the target app's import confirmation before applying it.
          </p>
          <QrCode :value="handout.url" :label="`QR handout for ${handout.channelName}`" :size="260" />
          <div class="text-body-small text-medium-emphasis">
            Channel key version {{ handout.pskVersion }}
          </div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="dialogOpen = false">Close</v-btn>
        <v-spacer />
        <v-btn
          v-if="handout"
          :prepend-icon="mdiContentCopy"
          variant="text"
          @click="copyLink"
        >
          Copy link
        </v-btn>
        <v-btn
          v-if="handout"
          :prepend-icon="mdiOpenInNew"
          color="primary"
          variant="flat"
          :href="handout.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open channel link
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
