<script setup lang="ts">
import SettingsRow from "@/shared/settings/SettingsRow.vue";
import AtakPreferenceValueField from "./AtakPreferenceValueField.vue";
import type { AtakCatalogKeyDto } from "./tak-configuration.api";
import { fieldLabel, settingId } from "./tak-settings";

/**
 * One whole-event ATAK setting. The (?) explains it and names ATAK's own default and the ATAK key;
 * below the name the row lists groups, roles or members that have their own value.
 */
defineProps<{
  definition: AtakCatalogKeyDto;
  value: string | null;
  defaultLabel: string | null;
  /** Other targets with their own value, already formatted; empty when there are none. */
  elsewhere: string;
  editable: boolean;
  messages: string[];
}>();
const emit = defineEmits<{ update: [value: string | null] }>();
</script>

<template>
  <SettingsRow
    :setting-id="settingId(definition.key)"
    :title="fieldLabel(definition)"
    :description="elsewhere === '' ? undefined : `Also set for ${elsewhere}`"
    :warning="definition.use === 'warning' ? `Check the effect before sending it to every device: ${definition.description}.` : undefined"
  >
    <template #hint>
      <p class="mb-3">{{ definition.description }}.</p>
      <div class="d-flex align-center ga-2 mb-2">
        <v-chip size="small" label variant="tonal" color="primary" class="hint-badge">Default</v-chip>
        <span>{{ defaultLabel ?? "ATAK sets none" }}</span>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="small" label variant="tonal" class="hint-badge">Key</v-chip>
        <code>{{ definition.key }}</code>
      </div>
    </template>
    <AtakPreferenceValueField
      :model-value="value"
      :label="fieldLabel(definition)"
      :definition="definition"
      :type="definition.type"
      :disabled="!editable"
      :error-messages="messages"
      @update:model-value="emit('update', $event)"
    />
  </SettingsRow>
</template>

<style scoped>
.hint-badge {
  min-width: 64px;
  justify-content: center;
}
</style>
