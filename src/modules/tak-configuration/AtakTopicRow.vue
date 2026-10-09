<script setup lang="ts">
import SettingsRow from "@/shared/settings/SettingsRow.vue";
import { computed } from "vue";
import AtakLockMenu from "./AtakLockMenu.vue";
import AtakPreferenceValueField from "./AtakPreferenceValueField.vue";
import type { AtakCatalogKeyDto } from "./tak-configuration.api";
import { fieldLabel, RESTRICTION_MODES, settingId, type RestrictionMode } from "./tak-settings";

/**
 * One whole-event ATAK setting. The (?) explains it and names ATAK's own default and the ATAK key;
 * below the name the row lists groups, roles or members that have their own value, and the lock
 * the event puts on the item in ATAK's settings screens.
 */
const props = defineProps<{
  definition: AtakCatalogKeyDto;
  value: string | null;
  defaultLabel: string | null;
  /** Other targets with their own value, already formatted; empty when there are none. */
  elsewhere: string;
  /** The whole event's lock of this item in ATAK; `null` when it sends none. */
  lock: RestrictionMode | null;
  editable: boolean;
  messages: string[];
}>();
const emit = defineEmits<{ update: [value: string | null]; lock: [mode: RestrictionMode | null] }>();

const description = computed(() => {
  const parts = [props.elsewhere === "" ? "" : `Also set for ${props.elsewhere}`];
  if (props.lock === "disabled" || props.lock === "hidden") {
    parts.push(`${RESTRICTION_MODES.find(({ value }) => value === props.lock)?.title ?? ""} in ATAK`);
  }
  return parts.filter((part) => part !== "").join(" · ") || undefined;
});
</script>

<template>
  <SettingsRow
    :setting-id="settingId(definition.key)"
    :title="fieldLabel(definition)"
    :description="description"
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
    <AtakLockMenu :mode="lock" :label="fieldLabel(definition)" :disabled="!editable" @update="emit('lock', $event)" />
  </SettingsRow>
</template>

<style scoped>
.hint-badge {
  min-width: 64px;
  justify-content: center;
}
</style>
