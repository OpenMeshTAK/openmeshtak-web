<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SettingsLayout from "@/shared/settings/SettingsLayout.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import MeshtasticChannelsPanel from "@/modules/meshtastic-channels/MeshtasticChannelsPanel.vue";
import TakConnectionSection from "@/modules/tak-configuration/TakConnectionSection.vue";
import PresetsSection from "@/modules/settings-presets/PresetsSection.vue";
import FirmwareSection from "./components/FirmwareSection.vue";
import SettingsSection from "./components/SettingsSection.vue";
import { meshtasticSearchIndex, meshtasticSections } from "./meshtastic-settings";
import {
  getConfiguration,
  getFirmwareProfile,
  listFirmwareProfiles,
  saveSettings,
  type FirmwareProfileDto,
  type FirmwareProfileSummaryDto,
  type MeshtasticConfigurationDto,
  type SettingValue,
} from "./meshtastic-configuration.api";

/**
 * The event's complete radio setup: a menu of firmware, channels and every section of the event's
 * firmware profile on the left, the selected part on the right, with a search over all of them.
 * Sections and fields come from the profile, so a new firmware line needs no change here.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

const configuration = ref<MeshtasticConfigurationDto | null>(null);
const profile = ref<FirmwareProfileDto | null>(null);
const profiles = ref<FirmwareProfileSummaryDto[]>([]);
const draft = ref<Record<string, SettingValue | undefined>>({});
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const selected = ref("firmware");
const saving = ref(false);
const saveErrors = ref<Record<string, string>>({});

/** A field appears when it is managed or available for the event's minimum firmware version. */
const visibleFields = computed(() =>
  (profile.value?.fields ?? []).filter(
    (field) =>
      field.managed ||
      (configuration.value !== null &&
        (field.key in configuration.value.settings || configuration.value.secretFields.includes(field.key))),
  ),
);
const sections = computed(() =>
  (profile.value?.sections ?? []).filter((section) =>
    visibleFields.value.some((field) => field.section === section.id),
  ),
);
const currentSection = computed(() => sections.value.find(({ id }) => id === selected.value));
const menuSections = computed(() => meshtasticSections(sections.value, configuration.value?.firmwareVersion ?? "", sectionHasProblem));
/** Rebuilt from the profile, so a firmware change never offers settings it does not support. */
const searchIndex = computed(() => meshtasticSearchIndex(sections.value, visibleFields.value, profile.value?.enums ?? {}));
const dirty = computed(() =>
  configuration.value !== null &&
  Object.entries(draft.value).some(([key, value]) => configuration.value?.settings[key] !== value),
);
const problemFields = computed(() =>
  Object.fromEntries((configuration.value?.problems ?? []).map(({ field, message }) => [field, message])),
);
const errors = computed(() => ({ ...problemFields.value, ...saveErrors.value }));
const fieldLabels = computed(() => Object.fromEntries((profile.value?.fields ?? []).map(({ key, label }) => [key, label])));

function sectionHasProblem(sectionId: string): boolean {
  return visibleFields.value.some(
    (field) =>
      field.section === sectionId &&
      (errors.value[`settings.${field.key}`] !== undefined || errors.value[`meshtastic.settings.${field.key}`] !== undefined),
  );
}

async function show(loaded: MeshtasticConfigurationDto): Promise<void> {
  configuration.value = loaded;
  draft.value = { ...loaded.settings };
  saveErrors.value = {};
  if (loaded.profileId !== null && profile.value?.id !== loaded.profileId) {
    profile.value = await getFirmwareProfile(loaded.profileId);
  }
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loaded, available] = await Promise.all([getConfiguration(props.eventId), listFirmwareProfiles()]);
    profiles.value = available;
    await show(loaded);
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

/** An imported preset changed the draft on the server. */
async function reload(): Promise<void> {
  try {
    await show(await getConfiguration(props.eventId));
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

function discard(): void {
  draft.value = { ...configuration.value?.settings };
  saveErrors.value = {};
}

async function save(): Promise<void> {
  if (configuration.value === null) {
    return;
  }
  saving.value = true;
  saveErrors.value = {};
  try {
    const settings = Object.fromEntries(
      Object.entries(draft.value).filter((entry): entry is [string, SettingValue] => entry[1] !== undefined),
    );
    await show(await saveSettings(props.eventId, configuration.value.version, settings));
    toast.success("Meshtastic settings saved.");
  } catch (caught: unknown) {
    saveErrors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <v-skeleton-loader v-if="state === 'loading'" type="list-item@6" />
    <ErrorState v-else-if="state === 'error' || configuration === null" :message="loadError" @retry="load" />

    <SettingsLayout v-else v-model="selected" :sections="menuSections" :search-index="searchIndex" label="Meshtastic settings">
      <FirmwareSection
        v-if="selected === 'firmware'"
        :event-id="eventId"
        :editable="editable"
        :configuration="configuration"
        :profile="profile"
        :profiles="profiles"
        @changed="show"
      />
      <MeshtasticChannelsPanel v-else-if="selected === 'channels'" :event-id="eventId" :editable="editable" :active="false" />
      <TakConnectionSection v-else-if="selected === 'tak-connection'" :event-id="eventId" :editable="editable" />
      <PresetsSection
        v-else-if="selected === 'presets'"
        kind="meshtastic"
        :event-id="eventId"
        :editable="editable"
        :dirty="dirty"
        :labels="fieldLabels"
        @imported="reload"
      />
      <template v-else-if="currentSection">
        <SettingsSection
          v-model="draft"
          :label="currentSection.label"
          :fields="visibleFields.filter((field) => field.section === currentSection?.id)"
          :enums="profile?.enums ?? {}"
          :editable="editable"
          :errors="errors"
          :event-id="eventId"
          :configuration="configuration"
          @secrets-changed="configuration = $event"
        />
        <v-slide-y-reverse-transition>
          <v-card v-if="editable && dirty" class="save-bar d-flex align-center ga-3 pa-3 mt-4" elevation="4">
            <span class="text-body-medium flex-grow-1">You have unsaved Meshtastic settings.</span>
            <v-btn variant="text" :disabled="saving" @click="discard">Discard</v-btn>
            <v-btn color="primary" :loading="saving" @click="save">Save changes</v-btn>
          </v-card>
        </v-slide-y-reverse-transition>
      </template>
    </SettingsLayout>
  </div>
</template>

<style scoped>
.save-bar {
  position: sticky;
  bottom: 16px;
}
</style>
