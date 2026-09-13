<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { Schemas } from "@/shared/api/types";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";
import { listAllEvents } from "@/modules/events/events.api";
import ApiKeysCard from "./components/ApiKeysCard.vue";
import ServiceAccountStatusChip from "./components/ServiceAccountStatusChip.vue";
import { useToast } from "@/shared/feedback/toast";
import { getServiceAccount, updateServiceAccount, type ServiceAccountDto } from "./service-accounts.api";

const route = useRoute();
const serviceAccountId = computed(() => String(route.params.serviceAccountId));

const form = ref({ name: "", description: "", status: "active" as Schemas["ServiceAccountStatus"] });
const grants = ref<Schemas["PermissionGrantDto"][]>([]);
const toast = useToast();
const saving = useSubmission();

function show(account: ServiceAccountDto): ServiceAccountDto {
  form.value = { name: account.name, description: account.description ?? "", status: account.status };
  grants.value = structuredClone(account.permissions);
  return account;
}

const page = useAsyncData(async () => {
  const [account, events] = await Promise.all([getServiceAccount(serviceAccountId.value), listAllEvents()]);
  return { account: show(account), events: events.map(({ id, name }) => ({ id, name })) };
}, null);

async function save(): Promise<void> {
  const current = page.data.value;
  if (current === null) {
    return;
  }
  const saved = await saving.run(async () => {
    current.account = show(
      await updateServiceAccount(current.account.id, {
        version: current.account.version,
        name: form.value.name,
        description: form.value.description || null,
        status: form.value.status,
        permissions: grants.value,
      }),
    );
  });
  if (saved !== null) {
    toast.success("Saved. Changes apply to all keys immediately.");
  } else {
    toast.error(saving.error.value);
  }
}

onMounted(page.load);
</script>

<template>
  <ViewContent :state="page.state.value" :error="page.error.value" @retry="page.load">
    <template v-if="page.data.value">
      <ViewHeader :title="page.data.value.account.name" subtitle="Service account">
        <template #actions><ServiceAccountStatusChip :status="page.data.value.account.status" /></template>
      </ViewHeader>


      <v-card class="pa-5 mb-6">
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
        <PermissionGrantEditor v-model="grants" :events="page.data.value.events" />
        <v-btn color="primary" class="mt-4" :loading="saving.submitting.value" @click="save">Save changes</v-btn>
      </v-card>

      <ApiKeysCard :service-account-id="serviceAccountId" />
    </template>
  </ViewContent>
</template>
