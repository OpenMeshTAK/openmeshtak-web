<script setup lang="ts">
import { mdiKeyPlus, mdiTrashCanOutline } from "@mdi/js";
import { onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import ReauthenticateDialog from "@/modules/auth/ReauthenticateDialog.vue";
import { useSession } from "@/modules/auth/session";
import { addPasskey, deletePasskey, listPasskeys, type PasskeySummary } from "../passkeys";

const session = useSession();
const toast = useToast();
const passkeys = useAsyncData(listPasskeys, []);

const adding = ref(false);
const reauthOpen = ref(false);
const removing = ref<PasskeySummary | null>(null);

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function describe(passkey: PasskeySummary): string {
  return passkey.backedUp ? "Synced passkey" : "Passkey on one device";
}

async function add(): Promise<void> {
  adding.value = true;
  try {
    const result = await addPasskey(session.state.principal?.name ?? "OpenMeshTak");
    if (result.outcome === "added") {
      toast.success("Passkey added. You can now sign in with it.");
      await passkeys.load();
    } else if (result.outcome === "sign-in-required") {
      reauthOpen.value = true;
    } else {
      toast.info(result.message);
    }
  } finally {
    adding.value = false;
  }
}

async function confirmRemove(): Promise<void> {
  const passkey = removing.value;
  removing.value = null;
  if (passkey === null) {
    return;
  }
  try {
    await deletePasskey(passkey.id);
    toast.success("Passkey removed.");
  } catch (caught: unknown) {
    toast.error(caught instanceof Error ? caught.message : "The passkey could not be removed.");
  }
  await passkeys.load();
}

onMounted(passkeys.load);
</script>

<template>
  <v-card>
    <v-card-item>
      <v-card-title>Passkeys</v-card-title>
      <v-card-subtitle class="text-wrap">
        Sign in with your device's fingerprint, face or screen lock instead of a password.
      </v-card-subtitle>
      <template #append>
        <v-btn color="primary" :prepend-icon="mdiKeyPlus" :loading="adding" @click="add">Add passkey</v-btn>
      </template>
    </v-card-item>
    <v-card-text>
      <v-skeleton-loader v-if="passkeys.state.value === 'loading'" type="list-item-two-line" />
      <v-alert v-else-if="passkeys.state.value === 'error'" type="error">{{ passkeys.error.value }}</v-alert>
      <p v-else-if="passkeys.data.value.length === 0" class="text-body-2 text-medium-emphasis mb-0">
        No passkeys yet.
      </p>
      <v-list v-else density="comfortable" class="pa-0">
        <v-list-item
          v-for="passkey in passkeys.data.value"
          :key="passkey.id"
          :title="describe(passkey)"
          :subtitle="`Added ${dateFormat.format(new Date(passkey.createdAt))}`"
        >
          <template #append>
            <v-btn
              :icon="mdiTrashCanOutline"
              variant="text"
              size="small"
              color="error"
              aria-label="Remove passkey"
              @click="removing = passkey"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>

    <ReauthenticateDialog v-model="reauthOpen" @confirmed="add" />

    <ConfirmDialog
      :model-value="removing !== null"
      title="Remove this passkey?"
      confirm-label="Remove"
      confirm-color="error"
      @update:model-value="removing = null"
      @confirm="confirmRemove"
    >
      You can no longer sign in with it. Remove it from your device's password manager as well.
    </ConfirmDialog>
  </v-card>
</template>
