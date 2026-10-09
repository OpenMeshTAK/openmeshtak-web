<script setup lang="ts">
import { mdiLock } from "@mdi/js";
import { computed } from "vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import SettingsHeaderActions from "@/shared/settings/SettingsHeaderActions.vue";
import { sectionIcon } from "../section-icons";
import { settingId } from "../meshtastic-settings";
import type {
  FirmwareEnumValueDto,
  FirmwareFieldDto,
  MeshtasticConfigurationDto,
  SettingValue,
} from "../meshtastic-configuration.api";
import FirmwareFieldInput from "./FirmwareFieldInput.vue";
import SecretFieldsCard from "./SecretFieldsCard.vue";

/**
 * One profile section such as LoRa, rendered only from the profile's field definitions: values in
 * a two-column grid, on/off settings as a list with their explanation, write-only secrets, and
 * server-managed values read-only at the end.
 */
const props = defineProps<{
  label: string;
  fields: FirmwareFieldDto[];
  enums: Record<string, FirmwareEnumValueDto[]>;
  editable: boolean;
  errors: Record<string, string>;
  eventId: string;
  configuration: MeshtasticConfigurationDto;
}>();
const emit = defineEmits<{ secretsChanged: [configuration: MeshtasticConfigurationDto] }>();
const settings = defineModel<Record<string, SettingValue | undefined>>({ required: true });

/**
 * Module sections such as MQTT have one `<section>.enabled` switch. It sits in the section header,
 * and the section's other settings are hidden while it is off because the device ignores them.
 */
const sectionSwitch = computed(
  () => props.fields.find((field) => field.type === "boolean" && !field.managed && !field.secret && field.key.endsWith(".enabled")) ?? null,
);
const sectionEnabled = computed(() => sectionSwitch.value === null || settings.value[sectionSwitch.value.key] === true);
const plainFields = computed(() =>
  props.fields.filter((field) => !field.managed && !field.secret && field !== sectionSwitch.value),
);
const valueFields = computed(() => plainFields.value.filter((field) => field.type !== "boolean"));
const switchFields = computed(() => plainFields.value.filter((field) => field.type === "boolean"));
const secretFields = computed(() => props.fields.filter((field) => field.secret));
const managedFields = computed(() => props.fields.filter((field) => field.managed));

function errorFor(field: FirmwareFieldDto): string | undefined {
  return props.errors[`settings.${field.key}`] ?? props.errors[`meshtastic.settings.${field.key}`];
}
</script>

<template>
  <div>
    <SettingsHeaderActions v-if="sectionSwitch">
      <v-switch
        :data-setting-id="settingId(sectionSwitch.key)"
        :model-value="sectionEnabled"
        :aria-label="sectionSwitch.label"
        :disabled="!editable"
        color="primary"
        hide-details
        inset
        @update:model-value="settings[sectionSwitch.key] = $event === true"
      />
    </SettingsHeaderActions>
    <div v-if="sectionSwitch && errorFor(sectionSwitch)" class="text-body-small text-error mb-4">{{ errorFor(sectionSwitch) }}</div>

    <div v-if="sectionSwitch && !sectionEnabled" class="section-off mb-4">
      <svg v-if="editable" class="section-off__arrow" viewBox="40 0 80 48" aria-hidden="true">
        <path d="M44 40 C 72 48, 96 40, 108 8" />
        <path d="M98 12 L 108 8 L 112 19" />
      </svg>
      <EmptyState
        :icon="sectionIcon(sectionSwitch.section)"
        :title="`${label} is off`"
        :text="editable ? `Turn on ${label} with the switch to see and change its settings.` : `Devices of this event do not use ${label}.`"
      />
    </div>

    <template v-if="sectionEnabled">
      <v-card v-if="valueFields.length > 0" class="pa-5 mb-4">
        <v-row dense>
          <v-col v-for="field in valueFields" :key="field.key" cols="12" lg="6" :data-setting-id="settingId(field.key)">
            <FirmwareFieldInput
              v-model="settings[field.key]"
              :field="field"
              :enum-values="field.enum ? (enums[field.enum] ?? []) : []"
              :disabled="!editable"
              :error="errorFor(field)"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-card v-if="switchFields.length > 0" class="mb-4">
        <v-list lines="two" class="py-0">
          <template v-for="(field, index) in switchFields" :key="field.key">
            <v-divider v-if="index > 0" />
            <v-list-item :title="field.label" :subtitle="field.description ?? ''" :data-setting-id="settingId(field.key)">
              <template #append>
                <v-switch
                  :model-value="settings[field.key] === true"
                  :aria-label="field.label"
                  :disabled="!editable"
                  color="primary"
                  hide-details
                  inset
                  @update:model-value="settings[field.key] = $event === true"
                />
              </template>
              <div v-if="errorFor(field)" class="text-body-small text-error mt-1">{{ errorFor(field) }}</div>
            </v-list-item>
          </template>
        </v-list>
      </v-card>

      <SecretFieldsCard
        v-if="secretFields.length > 0"
        :event-id="eventId"
        :fields="secretFields"
        :configuration="configuration"
        :editable="editable"
        @changed="emit('secretsChanged', $event)"
      />

      <v-card v-if="managedFields.length > 0" class="mb-4">
        <v-list lines="two" class="py-0">
          <template v-for="(field, index) in managedFields" :key="field.key">
            <v-divider v-if="index > 0" />
            <v-list-item
              :title="field.label"
              :subtitle="field.description ?? 'Set per member by OpenMeshTak.'"
              :data-setting-id="settingId(field.key)"
            >
              <template #append>
                <v-chip size="small" variant="tonal" label :prepend-icon="mdiLock">Managed</v-chip>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </template>
  </div>
</template>

<style scoped>
/* Placeholder for a switched-off section: present but quiet, the switch above is the action. */
.section-off {
  position: relative;
  opacity: 0.6;
}
/* Points at the section switch in the header above, which sits left of the 320px search field. */
.section-off__arrow {
  position: absolute;
  top: -10px;
  right: 360px;
  width: 80px;
  height: 48px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  opacity: 0.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 959px) {
  .section-off__arrow {
    display: none;
  }
}
</style>
