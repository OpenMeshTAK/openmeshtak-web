<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { listEventAccounts, makeEventAccountsPermanent, type UserDto } from "@/modules/users/users.api";
import type { EventDto } from "../events.api";

/**
 * The event's current event accounts, which archiving deletes. Administrators with
 * `event-accounts.manage` keep all of them, e.g. for a recurring group of participants.
 */
const props = defineProps<{ event: EventDto }>();
const session = useSession();
const toast = useToast();
const canManageAccounts = computed(() => session.can("event-accounts.manage", props.event.id));

const accounts = useAsyncData(() => listEventAccounts(props.event.id), [] as UserDto[]);
const confirming = ref(false);
const saving = ref(false);

const headers = [
  { title: "Name", key: "displayName" },
  { title: "Username", key: "username" },
  { title: "Email", key: "email", value: (account: UserDto) => account.email ?? "—" },
];

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

onMounted(() => void accounts.load());
</script>

<template>
  <v-card>
    <div class="d-flex align-center flex-wrap ga-3 pa-5 pb-3">
      <div class="flex-grow-1">
        <div class="text-title-medium font-weight-medium">Event accounts</div>
        <div class="text-body-medium text-medium-emphasis">Deleted when this event is archived.</div>
      </div>
      <v-btn
        v-if="canManageAccounts && accounts.data.value.length > 0"
        variant="outlined"
        @click="confirming = true"
      >
        Make all permanent users…
      </v-btn>
    </div>

    <v-skeleton-loader v-if="accounts.state.value === 'loading'" type="table-row@2" />
    <v-alert v-else-if="accounts.state.value === 'error'" type="error" class="ma-5">{{ accounts.error.value }}</v-alert>
    <p v-else-if="accounts.data.value.length === 0" class="text-body-medium px-5 pb-5 my-0">
      This event has no event accounts.
    </p>
    <v-data-table v-else :headers="headers" :items="accounts.data.value" density="comfortable" hide-default-footer :items-per-page="-1" />

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
