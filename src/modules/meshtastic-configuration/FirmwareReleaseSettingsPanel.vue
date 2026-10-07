<script setup lang="ts">
import { onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import FormSection from "@/shared/components/layout/FormSection.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import { getFirmwareReleaseSettings, saveFirmwareReleaseSettings, type FirmwareReleaseSettingsDto } from "./firmware-releases.api";

/** Whether Core looks up published Meshtastic firmware releases; saved as soon as it is switched. */
const toast = useToast();
const page = useAsyncData(getFirmwareReleaseSettings, null as FirmwareReleaseSettingsDto | null);
const saving = ref(false);

async function toggle(checkEnabled: boolean | null): Promise<void> {
  if (page.data.value === null || checkEnabled === null) {
    return;
  }
  saving.value = true;
  try {
    page.data.value = await saveFirmwareReleaseSettings(page.data.value.version, checkEnabled);
    toast.success(checkEnabled ? "Firmware release lookup switched on." : "Firmware release lookup switched off.");
  } catch (caught: unknown) {
    toast.error(caught);
    await page.load();
  } finally {
    saving.value = false;
  }
}

onMounted(page.load);
</script>

<template>
  <FormSection title="Meshtastic firmware releases" description="Which firmware builds exist, from the official Meshtastic flasher.">
    <div v-if="page.state.value === 'loading'" class="pa-4"><v-skeleton-loader type="list-item-two-line" /></div>
    <div v-else-if="page.state.value === 'error' || page.data.value === null" class="pa-4"><ErrorState :message="page.error.value" @retry="page.load" /></div>
    <div v-else class="px-4 pb-4 pt-3 d-flex align-center ga-4">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-1">
          <span class="text-title-small font-weight-medium">Look up published releases</span>
          <InfoHint
            label="About firmware release lookup"
            text="Core downloads the release list of flasher.meshtastic.org at most every 12 hours and keeps the last list for offline use. Switch it off when this installation must not contact the internet."
          />
        </div>
        <div v-if="!page.data.value.checkEnabled" class="text-body-medium text-medium-emphasis">Off: only the shipped firmware profiles are shown.</div>
      </div>
      <v-switch
        :model-value="page.data.value.checkEnabled"
        class="flex-grow-0 flex-shrink-0"
        color="primary"
        inset
        hide-details
        :loading="saving"
        :disabled="saving"
        aria-label="Look up published releases"
        @update:model-value="toggle"
      />
    </div>
  </FormSection>
</template>
