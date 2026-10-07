<script setup lang="ts">
import { mdiLinkPlus } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import OneTimeLinkReveal from "@/shared/components/OneTimeLinkReveal.vue";
import FormSection from "@/shared/components/layout/FormSection.vue";
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
  <FormSection title="Registration" description="Whether people can create their own account. New accounts have no permissions until you add them to user groups or events.">
    <div v-if="state === 'loading'" class="pa-4"><v-skeleton-loader type="article" /></div>
    <div v-else-if="state === 'error'" class="pa-4"><ErrorState :message="loadError" @retry="load" /></div>
    <template v-else>
      <div class="px-4 pb-4 pt-3">
        <v-radio-group v-model="mode" hide-details aria-label="Registration mode">
          <div class="mode-options">
            <div v-for="option in modes" :key="option.value">
              <!-- The whole tile selects its option; the radio keeps keyboard and screen reader support. -->
              <label class="mode-option" :class="{ 'mode-option--selected': mode === option.value }">
                <v-radio :value="option.value" density="compact" class="flex-grow-0" />
                <span>
                  <span class="d-block font-weight-medium">{{ option.title }}</span>
                  <span class="d-block text-body-medium text-medium-emphasis">{{ option.text }}</span>
                </span>
              </label>
            </div>
          </div>
        </v-radio-group>
        <div class="d-flex justify-end mt-3">
          <v-btn color="primary" :loading="saving" :disabled="!changed" @click="requestSave">Save</v-btn>
        </div>
      </div>

      <template v-if="settings?.mode === 'invite'">
        <v-divider />
        <div class="d-flex align-center flex-wrap ga-2 pa-4">
          <div class="flex-grow-1">
            <div class="text-title-small font-weight-medium">Invite links</div>
            <div class="text-body-medium text-medium-emphasis">Each link creates one account and expires after seven days.</div>
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
        <p v-else class="text-body-medium text-medium-emphasis pa-4 my-0">No invite links yet.</p>
      </template>
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
  </FormSection>
</template>

<style scoped>
/* Side by side when the section is wide enough, stacked in a narrow column. */
.mode-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  width: 100%;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  height: 100%;
  padding: 12px 12px 12px 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  cursor: pointer;
}

.mode-option--selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}
</style>
