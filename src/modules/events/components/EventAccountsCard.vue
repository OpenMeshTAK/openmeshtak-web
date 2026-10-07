<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { listEventAccounts, makeEventAccountsPermanent, type UserDto } from "@/modules/users/users.api";
import { settingsFromEvent, settingsToRequest } from "../event-settings";
import { updateEvent, type EventDto } from "../events.api";

/**
 * Whether people created for this event get event accounts (deleted on archive) or permanent
 * users, plus the event's current event accounts. The toggle saves on its own. Administrators with
 * `event-accounts.manage` change the setting and keep all current event accounts, e.g. for a
 * recurring group of participants.
 */
const props = defineProps<{ event: EventDto; editable: boolean }>();
const emit = defineEmits<{ updated: [event: EventDto] }>();
const session = useSession();
const toast = useToast();
const canReadUsers = computed(() => session.can("users.read"));
const canManageAccounts = computed(() => session.can("event-accounts.manage", props.event.id));

const accounts = useAsyncData(() => listEventAccounts(props.event.id), [] as UserDto[]);
const confirming = ref(false);
const saving = ref(false);
const savingToggle = ref(false);

/** Saves only this setting, based on the stored event, so unsaved edits elsewhere stay local. */
async function setPermanentAccounts(permanentAccounts: boolean | null): Promise<void> {
  savingToggle.value = true;
  try {
    const updated = await updateEvent(props.event.id, {
      version: props.event.version,
      ...settingsToRequest(settingsFromEvent(props.event)),
      permanentAccounts: permanentAccounts === true,
    });
    emit("updated", updated);
    toast.success(updated.permanentAccounts ? "New accounts are now permanent users." : "New accounts are now event accounts.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    savingToggle.value = false;
  }
}

async function makePermanent(): Promise<void> {
  saving.value = true;
  try {
    const count = await makeEventAccountsPermanent(props.event.id);
    confirming.value = false;
    toast.success(count === 1 ? "1 account is now a permanent user." : `${String(count)} accounts are now permanent users.`);
    await accounts.load();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (canReadUsers.value) {
    void accounts.load();
  }
});
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-2">
      <div class="text-title-medium font-weight-medium">Accounts</div>
      <InfoHint label="About event accounts" class="ml-2">
        <p class="mb-2">
          People created directly for this event and participants synchronized from an integration get an
          <strong>event account</strong>. Archiving the event deletes those accounts.
        </p>
        <p>Turn on permanent users to keep them instead. Accounts that already exist do not change.</p>
      </InfoHint>
    </div>

    <v-switch
      :model-value="event.permanentAccounts"
      label="Create new accounts as permanent users"
      color="primary"
      inset
      hide-details
      :loading="savingToggle"
      :disabled="!editable || !canManageAccounts || savingToggle"
      @update:model-value="setPermanentAccounts"
    />

    <template v-if="canReadUsers">
      <v-divider class="my-4" />
      <v-skeleton-loader v-if="accounts.state.value === 'loading'" type="text" />
      <v-alert v-else-if="accounts.state.value === 'error'" type="error">{{ accounts.error.value }}</v-alert>
      <template v-else>
        <p class="text-body-medium mt-0 mb-4">
          <template v-if="accounts.data.value.length === 0">This event has no event accounts.</template>
          <template v-else>
            {{ accounts.data.value.length === 1 ? "1 event account is" : `${accounts.data.value.length} event accounts are` }}
            deleted when this event is archived.
          </template>
        </p>
        <v-btn v-if="canManageAccounts && accounts.data.value.length > 0" variant="outlined" @click="confirming = true">
          Make all permanent users…
        </v-btn>
      </template>
    </template>

    <ConfirmDialog
      v-model="confirming"
      title="Keep these accounts?"
      confirm-label="Make permanent"
      :loading="saving"
      @confirm="makePermanent"
    >
      The {{ accounts.data.value.length }} event accounts of {{ event.name }} become permanent users. Archiving the
      event no longer deletes them; they keep their user groups and memberships in other events.
    </ConfirmDialog>
  </v-card>
</template>
