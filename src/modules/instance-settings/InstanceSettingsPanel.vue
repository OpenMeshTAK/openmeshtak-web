<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import FormSection from "@/shared/components/layout/FormSection.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { loadInstanceSettings, saveInstanceSettings, type InstanceSettingsDto } from "./instance-settings.api";

/** The installation's name, shown as the page title, on the sign-in page and in account emails. */
const toast = useToast();
const page = useAsyncData(loadInstanceSettings, null as InstanceSettingsDto | null);
const name = ref("");
const saving = ref(false);
const errors = ref<Record<string, string>>({});
const canSave = computed(() => page.data.value !== null && name.value.trim() !== "" && name.value.trim() !== page.data.value.name);

async function save(): Promise<void> {
  if (!canSave.value || page.data.value === null) {
    return;
  }
  saving.value = true;
  errors.value = {};
  try {
    page.data.value = await saveInstanceSettings(page.data.value.version, name.value.trim());
    name.value = page.data.value.name;
    toast.success("Name saved.");
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await page.load();
  name.value = page.data.value?.name ?? "";
});
</script>

<template>
  <FormSection title="Installation" description="The name people see in the browser tab, on the sign-in page and in account emails.">
    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="list-item-two-line" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="page.load" /></div>
    <div v-else class="px-4 pb-4 pt-3 d-flex align-start ga-3">
      <v-text-field
        v-model="name"
        label="Name"
        maxlength="60"
        class="flex-grow-1"
        :hide-details="errors.name === undefined"
        :error-messages="messagesFor(errors, 'name')"
        @keydown.enter="save"
      />
      <v-btn color="primary" height="40" :loading="saving" :disabled="!canSave" @click="save">Save</v-btn>
    </div>
  </FormSection>
</template>
