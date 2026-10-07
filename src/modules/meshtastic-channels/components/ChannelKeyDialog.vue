<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiContentCopy, mdiEye } from "@mdi/js";
import { ref, watch } from "vue";
import { useToast } from "@/shared/feedback/toast";
import {
  revealChannelKey,
  rotateChannelKey,
  type MeshtasticChannelDto,
} from "../meshtastic-channels.api";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  eventId: string;
  channel: MeshtasticChannelDto;
  canReveal: boolean;
  canRotate: boolean;
}>();
const emit = defineEmits<{ rotated: [channel: MeshtasticChannelDto] }>();
const toast = useToast();

const kindLabels: Record<MeshtasticChannelDto["psk"]["kind"], string> = {
  none: "No encryption",
  default: "Public default key",
  aes128: "AES-128",
  aes256: "AES-256",
};

/** The plain key stays only in this dialog and is dropped when it closes. */
const revealed = ref<string | null>(null);
const replacementKey = ref("");
const busy = ref(false);
const confirmRotate = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) {
    revealed.value = null;
    replacementKey.value = "";
    confirmRotate.value = false;
  }
});

async function reveal(): Promise<void> {
  busy.value = true;
  try {
    revealed.value = (await revealChannelKey(props.eventId, props.channel.id)).psk;
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    busy.value = false;
  }
}

async function rotate(): Promise<void> {
  busy.value = true;
  try {
    const key = replacementKey.value.trim();
    const rotated = await rotateChannelKey(props.eventId, props.channel, key === "" ? undefined : key);
    revealed.value = null;
    replacementKey.value = "";
    confirmRotate.value = false;
    toast.success(`The key of ${rotated.name} was replaced.`);
    emit("rotated", rotated);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    busy.value = false;
  }
}

async function copy(): Promise<void> {
  if (revealed.value !== null) {
    try {
      await navigator.clipboard.writeText(revealed.value);
      toast.success("Key copied to the clipboard.");
    } catch (caught: unknown) {
      toast.error(caught);
    }
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="pa-2">
      <v-card-title>Key of {{ channel.name }}</v-card-title>
      <v-card-text>
        <dl class="key-facts text-body-2 mb-4">
          <dt>Encryption</dt>
          <dd>{{ kindLabels[channel.psk.kind] }}</dd>
          <dt>Key version</dt>
          <dd>{{ channel.psk.version }}</dd>
          <dt>Last rotated</dt>
          <dd>{{ channel.psk.rotatedAt ? new Date(channel.psk.rotatedAt).toLocaleString() : "Never" }}</dd>
        </dl>

        <v-text-field
          :model-value="revealed === '' ? '(no encryption key)' : (revealed ?? '••••••••••••••••••••••••••••••••')"
          label="Key (base64)"
          readonly
          hide-details
          style="font-family: monospace"
        >
          <template #append-inner>
            <v-btn
              v-if="revealed !== null"
              :icon="mdiContentCopy"
              variant="text"
              size="small"
              aria-label="Copy key"
              @click="copy"
            />
            <v-btn
              v-else-if="canReveal"
              :icon="mdiEye"
              variant="text"
              size="small"
              aria-label="Reveal key"
              :loading="busy"
              @click="reveal"
            />
          </template>
        </v-text-field>
        <div class="text-caption text-medium-emphasis mt-1">
          {{ canReveal ? "Every reveal is recorded in the audit log." : "You may not reveal channel keys." }}
        </div>

        <v-alert v-if="confirmRotate" type="warning" variant="tonal" class="mt-4">
          Devices that already have the old key stop hearing this channel until they receive the new
          one. Profiles and handouts use only the new key from now on.
          <v-text-field
            v-model="replacementKey"
            label="Existing replacement key (optional)"
            autocomplete="off"
            class="mt-3"
          >
            <template #append-inner>
              <InfoHint label="About existing replacement key" text="Leave empty to generate a new random key. Otherwise paste the base64 key." />
            </template>
          </v-text-field>
          <div class="mt-3">
            <v-btn color="warning" variant="flat" size="small" :loading="busy" @click="rotate">Replace key</v-btn>
            <v-btn variant="text" size="small" class="ml-2" @click="confirmRotate = false">Cancel</v-btn>
          </div>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="canRotate && !confirmRotate" color="warning" variant="text" @click="confirmRotate = true">
          Replace key
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.key-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
}
.key-facts dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.key-facts dd {
  margin: 0;
}
</style>
