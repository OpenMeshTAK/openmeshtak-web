<script setup lang="ts">
import { mdiLinkPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import OneTimeLinkReveal from "@/shared/components/OneTimeLinkReveal.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import {
  createRegistrationInvite,
  listRegistrationInvites,
  loadRegistrationSettings,
  revokeRegistrationInvite,
  saveRegistrationSettings,
  type RegistrationInviteDto,
  type RegistrationMode,
  type RegistrationSettingsDto,
} from "./registration.api";

/**
 * Whether people may create their own account. Closed is the default; invite-only needs a
 * single-use invite link per person; open lets anyone who reaches the instance sign up. New
 * accounts never get permissions by themselves.
 */
const toast = useToast();

const settings = ref<RegistrationSettingsDto | null>(null);
const mode = ref<RegistrationMode>("closed");
const invites = ref<RegistrationInviteDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const saving = ref(false);
const confirmOpen = ref(false);

const creating = ref(false);
/** The new invite link lives only here while its dialog is open. */
const created = ref<{ url: string; expiresAt: string } | null>(null);

const modes: { value: RegistrationMode; title: string; text: string }[] = [
  { value: "closed", title: "Closed", text: "Only administrators create accounts, and participants arrive through access links." },
  { value: "invite", title: "Invite only", text: "People sign up with a single-use invite link you create below." },
  { value: "open", title: "Open", text: "Anyone who can reach this installation can create an account." },
];
const changed = computed(() => settings.value !== null && mode.value !== settings.value.mode);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const STATUS_COLORS: Record<RegistrationInviteDto["status"], string> = {
  open: "success",
  consumed: "info",
  revoked: "error",
  expired: "default",
};

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loaded, loadedInvites] = await Promise.all([loadRegistrationSettings(), listRegistrationInvites()]);
    settings.value = loaded;
    mode.value = loaded.mode;
    invites.value = loadedInvites;
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

/** Opening registration to everyone is confirmed first; the other changes save directly. */
function requestSave(): void {
  if (mode.value === "open") {
    confirmOpen.value = true;
  } else {
    void save();
  }
}

async function save(): Promise<void> {
  if (settings.value === null) {
    return;
  }
  saving.value = true;
  try {
    settings.value = await saveRegistrationSettings(settings.value.version, mode.value);
    mode.value = settings.value.mode;
    toast.success("Registration settings saved.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    saving.value = false;
    confirmOpen.value = false;
  }
}

async function createInvite(): Promise<void> {
  creating.value = true;
  try {
    const result = await createRegistrationInvite();
    created.value = { url: result.inviteUrl, expiresAt: result.invite.expiresAt };
    invites.value = [result.invite, ...invites.value];
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    creating.value = false;
  }
}

async function revoke(invite: RegistrationInviteDto): Promise<void> {
  try {
    const revoked = await revokeRegistrationInvite(invite.id);
    invites.value = invites.value.map((item) => (item.id === revoked.id ? revoked : item));
    toast.success("Invite revoked.");
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <ViewHeader title="Registration" subtitle="Whether people can create their own OpenMeshTak account." />

    <v-skeleton-loader v-if="state === 'loading'" type="article" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <template v-else>
      <v-card class="pa-5 mb-4" style="max-width: 760px">
        <v-radio-group v-model="mode" hide-details>
          <v-radio v-for="option in modes" :key="option.value" :value="option.value" class="mb-2">
            <template #label>
              <div>
                <div class="font-weight-medium">{{ option.title }}</div>
                <div class="text-body-2 text-medium-emphasis">{{ option.text }}</div>
              </div>
            </template>
          </v-radio>
        </v-radio-group>
        <p class="text-body-2 text-medium-emphasis mt-4 mb-0">
          New accounts have no permissions. Add them to user groups or events to give them access.
        </p>
        <div class="d-flex justify-end mt-4">
          <v-btn color="primary" :loading="saving" :disabled="!changed" @click="requestSave">Save</v-btn>
        </div>
      </v-card>

      <v-card v-if="settings?.mode === 'invite'" style="max-width: 760px">
        <div class="d-flex align-center flex-wrap ga-2 pa-4">
          <div class="flex-grow-1">
            <div class="text-subtitle-1 font-weight-medium">Invite links</div>
            <div class="text-body-2 text-medium-emphasis">Each link creates one account and expires after seven days.</div>
          </div>
          <v-btn color="primary" variant="tonal" :prepend-icon="mdiLinkPlus" :loading="creating" @click="createInvite">Create invite link</v-btn>
        </div>
        <v-divider />
        <v-table v-if="invites.length > 0">
          <thead>
            <tr>
              <th>Created</th>
              <th>Status</th>
              <th class="d-none d-sm-table-cell">Expires</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invite in invites" :key="invite.id">
              <td>{{ dateFormat.format(new Date(invite.createdAt)) }}</td>
              <td><v-chip size="small" variant="tonal" :color="STATUS_COLORS[invite.status]">{{ invite.status }}</v-chip></td>
              <td class="d-none d-sm-table-cell">{{ dateFormat.format(new Date(invite.expiresAt)) }}</td>
              <td class="text-right">
                <v-btn v-if="invite.status === 'open'" variant="text" size="small" color="error" @click="revoke(invite)">Revoke</v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2 text-medium-emphasis pa-4 mb-0">No invite links yet.</p>
      </v-card>
    </template>

    <v-dialog :model-value="created !== null" max-width="520" @update:model-value="created = null">
      <v-card v-if="created" class="pa-2">
        <v-card-title>Invite link</v-card-title>
        <v-card-text>
          <OneTimeLinkReveal :url="created.url" :expires-at="created.expiresAt" label="Invite link">
            Anyone with this link can create one account. Share it privately. It is shown only now
            and cannot be displayed again.
          </OneTimeLinkReveal>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="created = null">Done</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog v-model="confirmOpen" title="Open registration to everyone?" confirm-label="Open registration" :loading="saving" @confirm="save">
      Anyone who can reach this installation can then create an account. New accounts have no
      permissions, but they can sign in and appear in the user list.
    </ConfirmDialog>
  </div>
</template>
