<script setup lang="ts">
import { mdiContentCopy } from "@mdi/js";
import { ref, watch } from "vue";
import QrCode from "@/shared/components/QrCode.vue";
import { describeError } from "@/shared/errors/api-problem";
import { createClaim } from "@/modules/members/members.api";

const props = defineProps<{ eventId: string; memberId: string; callsign: string }>();
const open = defineModel<boolean>({ required: true });

/**
 * The link contains a single-use bearer token. It exists only in this dialog's memory while it is
 * open: never in the URL, browser storage, logs or a shared store, and it is cleared on close.
 */
const claimUrl = ref<string | null>(null);
const expiresAt = ref<string | null>(null);
const creating = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

function clear(): void {
  claimUrl.value = null;
  expiresAt.value = null;
  error.value = null;
  copied.value = false;
}

async function create(): Promise<void> {
  creating.value = true;
  error.value = null;
  try {
    const created = await createClaim(props.eventId, props.memberId);
    claimUrl.value = created.claimUrl;
    expiresAt.value = new Date(created.claim.expiresAt).toLocaleString();
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    creating.value = false;
  }
}

/** Copying is an explicit user action; nothing is written to the clipboard automatically. */
async function copy(): Promise<void> {
  if (claimUrl.value !== null) {
    await navigator.clipboard.writeText(claimUrl.value);
    copied.value = true;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    clear();
  }
});
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title class="text-wrap">Access link for {{ callsign }}</v-card-title>
      <v-card-text>
        <template v-if="claimUrl === null">
          <p class="text-body-2 mb-4">
            The participant opens this link (or scans its QR code) once to sign in to OpenMeshTak
            without a password. It works a single time and expires after 24 hours. Creating a new
            link invalidates earlier ones.
          </p>
          <v-alert v-if="error" type="error" class="mb-2">{{ error }}</v-alert>
        </template>

        <template v-else>
          <v-alert type="warning" class="mb-4">
            Anyone with this link can sign in as {{ callsign }}. Share it privately. It is shown only
            now and cannot be displayed again.
          </v-alert>
          <div class="d-flex justify-center mb-4">
            <QrCode :value="claimUrl" :label="`Access link QR code for ${callsign}`" />
          </div>
          <v-text-field :model-value="claimUrl" label="Access link" readonly hide-details class="mb-2">
            <template #append-inner>
              <v-btn :icon="mdiContentCopy" variant="text" size="small" aria-label="Copy access link" @click="copy" />
            </template>
          </v-text-field>
          <div class="text-caption text-medium-emphasis">
            {{ copied ? "Copied. " : "" }}Valid until {{ expiresAt }}, single use.
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ claimUrl === null ? "Cancel" : "Done" }}</v-btn>
        <v-btn v-if="claimUrl === null" color="primary" variant="flat" :loading="creating" @click="create">
          Create access link
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
