<script setup lang="ts">
import { mdiAccessPointNetwork, mdiChip, mdiCog } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import MeshtasticChannelsPanel from "@/modules/meshtastic-channels/MeshtasticChannelsPanel.vue";
import FirmwareSection from "./components/FirmwareSection.vue";
import SettingsSection from "./components/SettingsSection.vue";
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
 * firmware profile on the left, the selected part on the right. Sections and fields come from the
 * profile, so a new firmware line needs no change here.
 */
const props = defineProps<{ eventId: string; editable: boolean; active: boolean }>();
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
    (field) => field.managed || (configuration.value !== null && field.key in configuration.value.settings),
  ),
);
const sections = computed(() =>
  (profile.value?.sections ?? []).filter((section) =>
    visibleFields.value.some((field) => field.section === section.id),
  ),
);
const currentSection = computed(() => sections.value.find(({ id }) => id === selected.value));
const dirty = computed(() =>
  configuration.value !== null &&
  Object.entries(draft.value).some(([key, value]) => configuration.value?.settings[key] !== value),
);
const problemFields = computed(() =>
  Object.fromEntries((configuration.value?.problems ?? []).map(({ field, message }) => [field, message])),
);
const errors = computed(() => ({ ...problemFields.value, ...saveErrors.value }));

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
    <v-alert v-if="active" type="info" variant="tonal" class="mb-4">
      Meshtastic changes stay in the event draft until you publish a new configuration revision from
      the Overview tab.
    </v-alert>

    <v-skeleton-loader v-if="state === 'loading'" type="list-item@6" />
    <ErrorState v-else-if="state === 'error' || configuration === null" :message="loadError" @retry="load" />

    <v-row v-else>
      <v-col cols="12" md="3" lg="2">
        <v-list
          density="compact"
          nav
          mandatory
          class="meshtastic-menu"
          :selected="[selected]"
          @update:selected="selected = String($event[0] ?? selected)"
        >
          <v-list-item value="firmware" :prepend-icon="mdiChip" title="Firmware" :subtitle="configuration.firmwareVersion" />
          <v-list-item value="channels" :prepend-icon="mdiAccessPointNetwork" title="Channels" />
          <v-divider class="my-2" />
          <v-list-item
            v-for="section in sections"
            :key="section.id"
            :value="section.id"
            :prepend-icon="mdiCog"
            :title="section.label"
          >
            <template v-if="sectionHasProblem(section.id)" #append>
              <v-badge color="error" dot inline />
            </template>
          </v-list-item>
        </v-list>
      </v-col>

      <v-col cols="12" md="9" lg="10">
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
        <v-card v-else-if="currentSection" class="pa-5">
          <SettingsSection
            v-model="draft"
            :label="currentSection.label"
            :fields="visibleFields.filter((field) => field.section === currentSection?.id)"
            :enums="profile?.enums ?? {}"
            :editable="editable"
            :errors="errors"
          />
          <div v-if="editable" class="d-flex align-center ga-3 mt-2">
            <v-btn color="primary" :disabled="!dirty" :loading="saving" @click="save">Save settings</v-btn>
            <span v-if="dirty" class="text-caption text-medium-emphasis">Unsaved changes in one or more sections</span>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.meshtastic-menu {
  position: sticky;
  top: 16px;
}
</style>
