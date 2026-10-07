<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiKeyPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import OneTimeCredentialReveal from "@/shared/components/OneTimeCredentialReveal.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { useToast } from "@/shared/feedback/toast";
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeyDto } from "../api-clients.api";

/** API-key lifecycle of one API client: create (rotate), reveal once, revoke. */
const props = defineProps<{ apiClientId: string }>();
const toast = useToast();

const keys = useAsyncData(() => listApiKeys(props.apiClientId), [] as ApiKeyDto[]);
const activeKeys = computed(() => keys.data.value.filter(({ status }) => status === "active").length);

const dialogOpen = ref(false);
const keyName = ref("");
const creation = useSubmission();
/** The plaintext key lives only here and only until the operator dismisses the reveal. */
const revealedKey = ref<string | null>(null);
const revoking = ref<ApiKeyDto | null>(null);

function openDialog(): void {
  keyName.value = activeKeys.value > 0 ? "rotated key" : "primary key";
  creation.reset();
  revealedKey.value = null;
  dialogOpen.value = true;
}

function closeDialog(): void {
  revealedKey.value = null;
  dialogOpen.value = false;
}

async function create(): Promise<void> {
  const created = await creation.run(() => createApiKey(props.apiClientId, { name: keyName.value }));
  if (created !== null) {
    revealedKey.value = created.value.key;
    await keys.load();
  }
}

async function confirmRevoke(): Promise<void> {
  const key = revoking.value;
  revoking.value = null;
  if (key === null) {
    return;
  }
  try {
    await revokeApiKey(props.apiClientId, key.id);
    toast.success(`${key.name} was revoked and stops working immediately.`);
    await keys.load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(keys.load);
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-2">
      <div class="text-title-medium font-weight-medium flex-grow-1">API keys</div>
      <v-btn color="primary" :prepend-icon="mdiKeyPlus" @click="openDialog">
        {{ activeKeys > 0 ? "Rotate: create new key" : "Create key" }}
      </v-btn>
    </div>
    <p class="text-body-medium text-medium-emphasis mt-0 mb-3">
      To rotate, create a new key, switch the integration to it, then revoke the old key.
    </p>

    <v-skeleton-loader v-if="keys.state.value === 'loading'" type="table-row@2" />
    <v-alert v-else-if="keys.state.value === 'error'" type="error">{{ keys.error.value }}</v-alert>
    <v-table v-else-if="keys.data.value.length > 0" density="compact">
      <thead>
        <tr>
          <th>Name</th>
          <th>Key</th>
          <th>Status</th>
          <th>Last used</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="key in keys.data.value" :key="key.id">
          <td>{{ key.name }}</td>
          <td><code class="text-body-small">{{ key.displayPrefix }}…</code></td>
          <td>{{ key.status }}</td>
          <td>{{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never" }}</td>
          <td class="text-right">
            <v-btn v-if="key.status === 'active'" variant="text" size="small" color="error" @click="revoking = key">
              Revoke
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
    <p v-else class="text-body-medium ma-0">No keys yet.</p>

    <v-dialog :model-value="dialogOpen" max-width="620" persistent>
      <v-card class="pa-2">
        <v-card-title>{{ revealedKey ? "New API key" : "Create API key" }}</v-card-title>
        <v-card-text>
          <OneTimeCredentialReveal v-if="revealedKey" :secret="revealedKey" label="API key" @dismiss="closeDialog" />
          <template v-else>
            <v-alert v-if="creation.error.value" type="error" class="mb-4">{{ creation.error.value }}</v-alert>
            <v-text-field v-model="keyName" label="Key name">
              <template #append-inner>
                <InfoHint label="About key name" text="Helps you tell keys apart, e.g. production" />
              </template>
            </v-text-field>
          </template>
        </v-card-text>
        <v-card-actions v-if="!revealedKey">
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="creation.submitting.value" @click="create">Create key</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      :model-value="revoking !== null"
      title="Revoke this key?"
      confirm-label="Revoke"
      confirm-color="error"
      @update:model-value="revoking = null"
      @confirm="confirmRevoke"
    >
      {{ revoking?.name }} stops working immediately. Integrations still using it will fail until they
      switch to another key.
    </ConfirmDialog>
  </v-card>
</template>
