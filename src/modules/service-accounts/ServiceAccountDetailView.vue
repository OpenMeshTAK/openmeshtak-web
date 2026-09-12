<script setup lang="ts">
import { mdiKeyPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import OneTimeCredentialReveal from "@/shared/components/OneTimeCredentialReveal.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import ReauthenticateDialog from "@/modules/auth/ReauthenticateDialog.vue";
import { listAllEvents } from "@/modules/events/events.api";
import {
  createApiKey,
  getServiceAccount,
  listApiKeys,
  revokeApiKey,
  updateServiceAccount,
  type ApiKeyDto,
  type ServiceAccountDto,
} from "./service-accounts.api";

const route = useRoute();
const serviceAccountId = computed(() => String(route.params.serviceAccountId));

const account = ref<ServiceAccountDto | null>(null);
const keys = ref<ApiKeyDto[]>([]);
const events = ref<{ id: string; name: string }[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");

const form = ref({ name: "", description: "", status: "active" as Schemas["ServiceAccountStatus"] });
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const saving = ref(false);
const notice = ref<{ type: "success" | "error"; text: string } | null>(null);

const keyDialogOpen = ref(false);
const keyName = ref("");
const creatingKey = ref(false);
const keyError = ref<string | null>(null);
const reauthOpen = ref(false);
/** The plaintext key lives only here and only until the operator dismisses the reveal. */
const revealedKey = ref<string | null>(null);

const revoking = ref<ApiKeyDto | null>(null);
const activeKeys = computed(() => keys.value.filter(({ status }) => status === "active").length);

function show(loaded: ServiceAccountDto): void {
  account.value = loaded;
  form.value = { name: loaded.name, description: loaded.description ?? "", status: loaded.status };
  grants.value = structuredClone(loaded.permissions);
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedAccount, loadedKeys, loadedEvents] = await Promise.all([
      getServiceAccount(serviceAccountId.value),
      listApiKeys(serviceAccountId.value),
      listAllEvents(),
    ]);
    show(loadedAccount);
    keys.value = loadedKeys;
    events.value = loadedEvents.map(({ id, name }) => ({ id, name }));
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

async function save(): Promise<void> {
  if (account.value === null) {
    return;
  }
  saving.value = true;
  notice.value = null;
  try {
    show(
      await updateServiceAccount(account.value.id, {
        version: account.value.version,
        name: form.value.name,
        description: form.value.description || null,
        status: form.value.status,
        permissions: grants.value,
      }),
    );
    notice.value = { type: "success", text: "Saved. Changes apply to all keys immediately." };
  } catch (caught: unknown) {
    notice.value = { type: "error", text: describeError(caught) };
  } finally {
    saving.value = false;
  }
}

function openKeyDialog(): void {
  keyName.value = activeKeys.value > 0 ? "rotated key" : "primary key";
  keyError.value = null;
  revealedKey.value = null;
  keyDialogOpen.value = true;
}

async function createKey(): Promise<void> {
  creatingKey.value = true;
  keyError.value = null;
  try {
    const created = await createApiKey(serviceAccountId.value, { name: keyName.value });
    revealedKey.value = created.key;
    keys.value = await listApiKeys(serviceAccountId.value);
  } catch (caught: unknown) {
    if (isApiProblem(caught, "RECENT_AUTHENTICATION_REQUIRED")) {
      reauthOpen.value = true;
    } else {
      keyError.value = describeError(caught);
    }
  } finally {
    creatingKey.value = false;
  }
}

function closeKeyDialog(): void {
  revealedKey.value = null;
  keyDialogOpen.value = false;
}

async function confirmRevoke(): Promise<void> {
  if (revoking.value === null) {
    return;
  }
  try {
    await revokeApiKey(serviceAccountId.value, revoking.value.id);
    keys.value = await listApiKeys(serviceAccountId.value);
    notice.value = { type: "success", text: `${revoking.value.name} was revoked and stops working immediately.` };
  } catch (caught: unknown) {
    notice.value = { type: "error", text: describeError(caught) };
  } finally {
    revoking.value = null;
  }
}

onMounted(load);
</script>

<template>
  <v-container fluid class="pt-3 pb-6 px-6">
    <v-skeleton-loader v-if="state === 'loading'" type="heading, article" />
    <ErrorState v-else-if="state === 'error' || account === null" :message="loadError" @retry="load" />

    <template v-else>
      <PageHeader :title="account.name" subtitle="Service account">
        <template #actions>
          <v-chip :color="account.status === 'active' ? 'success' : 'secondary'" size="small" variant="tonal" label>
            {{ account.status === "active" ? "Active" : "Disabled" }}
          </v-chip>
        </template>
      </PageHeader>

      <v-alert v-if="notice" :type="notice.type" closable class="mb-4" @click:close="notice = null">
        {{ notice.text }}
      </v-alert>

      <v-row>
        <v-col cols="12">
          <v-card class="pa-5">
            <div class="text-subtitle-1 font-weight-medium mb-4">Settings and permissions</div>
            <v-text-field v-model="form.name" label="Name" />
            <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow />
            <v-switch
              :model-value="form.status === 'active'"
              color="success"
              label="Active (disabling blocks every key immediately)"
              inset
              @update:model-value="form.status = $event ? 'active' : 'disabled'"
            />
            <PermissionGrantEditor v-model="grants" :events="events" />
            <v-btn color="primary" class="mt-4" :loading="saving" @click="save">Save changes</v-btn>
          </v-card>
        </v-col>

        <v-col cols="12">
          <v-card class="pa-5">
            <div class="d-flex align-center mb-2">
              <div class="text-subtitle-1 font-weight-medium flex-grow-1">API keys</div>
              <v-btn color="primary" :prepend-icon="mdiKeyPlus" @click="openKeyDialog">
                {{ activeKeys > 0 ? "Rotate: create new key" : "Create key" }}
              </v-btn>
            </div>
            <p class="text-body-2 text-medium-emphasis">
              To rotate, create a new key, switch the integration to it, then revoke the old key.
            </p>
            <v-table v-if="keys.length > 0" density="compact">
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
                <tr v-for="key in keys" :key="key.id">
                  <td>{{ key.name }}</td>
                  <td><code class="text-caption">{{ key.displayPrefix }}…</code></td>
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
            <p v-else class="text-body-2">No keys yet.</p>
          </v-card>
        </v-col>
      </v-row>

      <v-dialog :model-value="keyDialogOpen" max-width="620" persistent>
        <v-card class="pa-2">
          <v-card-title>{{ revealedKey ? "New API key" : "Create API key" }}</v-card-title>
          <v-card-text>
            <OneTimeCredentialReveal v-if="revealedKey" :secret="revealedKey" label="API key" @dismiss="closeKeyDialog" />
            <template v-else>
              <v-alert v-if="keyError" type="error" class="mb-4">{{ keyError }}</v-alert>
              <v-text-field v-model="keyName" label="Key name" hint="Helps you tell keys apart, e.g. production" persistent-hint />
            </template>
          </v-card-text>
          <v-card-actions v-if="!revealedKey">
            <v-spacer />
            <v-btn variant="text" @click="closeKeyDialog">Cancel</v-btn>
            <v-btn color="primary" variant="flat" :loading="creatingKey" @click="createKey">Create key</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <ReauthenticateDialog v-model="reauthOpen" @confirmed="createKey" />

      <ConfirmDialog
        :model-value="revoking !== null"
        title="Revoke this key?"
        confirm-label="Revoke"
        confirm-color="error"
        @update:model-value="revoking = null"
        @confirm="confirmRevoke"
      >
        {{ revoking?.name }} stops working immediately. Integrations still using it will fail until
        they switch to another key.
      </ConfirmDialog>
    </template>
  </v-container>
</template>
