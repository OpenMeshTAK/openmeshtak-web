<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import {
  getTakConfiguration,
  updateAtakPreferenceFile,
  updateTakConfiguration,
  type AtakSettingsDto,
  type TakConfigurationDto,
} from "./tak-configuration.api";

/**
 * ATAK settings every member's app receives through its device profile: an optional `.pref` file
 * exported from a configured ATAK, with the choices below on top. Members get changes once the
 * configuration is published.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

type SettingName = keyof AtakSettingsDto;

const choices: Array<{ name: SettingName; label: string; items: Array<{ value: string; title: string }> }> = [
  {
    name: "coordinateFormat",
    label: "Coordinate format",
    items: [
      { value: "MGRS", title: "MGRS" },
      { value: "DD", title: "Decimal degrees" },
      { value: "DM", title: "Degrees, minutes" },
      { value: "DMS", title: "Degrees, minutes, seconds" },
      { value: "UTM", title: "UTM" },
    ],
  },
  {
    name: "distanceUnit",
    label: "Distance",
    items: [
      { value: "metric", title: "Meters, kilometers" },
      { value: "imperial", title: "Feet, miles" },
      { value: "nautical", title: "Nautical miles" },
    ],
  },
  {
    name: "altitudeUnit",
    label: "Altitude unit",
    items: [
      { value: "meters", title: "Meters" },
      { value: "feet", title: "Feet" },
    ],
  },
  {
    name: "altitudeReference",
    label: "Altitude reference",
    items: [
      { value: "MSL", title: "Mean sea level (MSL)" },
      { value: "HAE", title: "Height above ellipsoid (HAE)" },
    ],
  },
  {
    name: "speedUnit",
    label: "Speed",
    items: [
      { value: "kmh", title: "km/h" },
      { value: "mph", title: "mph" },
      { value: "knots", title: "Knots" },
      { value: "mps", title: "m/s" },
    ],
  },
  {
    name: "northReference",
    label: "North reference",
    items: [
      { value: "true", title: "True north" },
      { value: "magnetic", title: "Magnetic north" },
      { value: "grid", title: "Grid north" },
    ],
  },
];

const configuration = ref<TakConfigurationDto | null>(null);
const settings = ref<AtakSettingsDto | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const saving = ref(false);
const uploading = ref(false);
const fields = ref<Record<string, string>>({});
const removedKeys = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const dirty = computed(
  () => configuration.value !== null && JSON.stringify(configuration.value.atakSettings) !== JSON.stringify(settings.value),
);

function show(loaded: TakConfigurationDto): void {
  configuration.value = loaded;
  settings.value = { ...loaded.atakSettings };
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    show(await getTakConfiguration(props.eventId));
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

async function save(): Promise<void> {
  if (configuration.value === null || settings.value === null) {
    return;
  }
  saving.value = true;
  fields.value = {};
  try {
    show(
      await updateTakConfiguration(props.eventId, {
        version: configuration.value.version,
        meshChannelId: configuration.value.meshChannelId,
        atakSettings: settings.value,
      }),
    );
    toast.success("ATAK settings saved. Publish the configuration so members get them.");
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

async function replaceFile(file: { fileName: string; content: string } | null): Promise<void> {
  if (configuration.value === null) {
    return;
  }
  uploading.value = true;
  fields.value = {};
  try {
    const result = await updateAtakPreferenceFile(props.eventId, { version: configuration.value.version, file });
    show(result.configuration);
    removedKeys.value = result.removedKeys;
    toast.success(file === null ? "Preference file removed." : "Preference file saved. Publish the configuration so members get it.");
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    uploading.value = false;
  }
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file !== undefined) {
    await replaceFile({ fileName: file.name, content: await file.text() });
  }
}

onMounted(load);
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-2">
      <div class="text-title-medium font-weight-medium">ATAK settings</div>
      <InfoHint label="About ATAK settings" class="ml-2">
        <p class="mb-2">Every member's ATAK gets these settings from the TAK server when it enrolls, and again after a change.</p>
        <p class="mb-2">
          For anything not listed here, set up one ATAK the way it should be, export its settings as a .pref file and upload it.
          The choices below override the same settings of the file.
        </p>
        <p>If a member is in several active events, the event that started last wins for each setting.</p>
      </InfoHint>
    </div>

    <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />

    <template v-else-if="settings !== null && configuration !== null">
      <v-row dense>
        <v-col v-for="choice in choices" :key="choice.name" cols="12" sm="6" md="4">
          <v-select
            v-model="settings[choice.name]"
            :items="choice.items"
            :label="choice.label"
            placeholder="ATAK default"
            persistent-placeholder
            clearable
            :disabled="!editable"
            :error-messages="messagesFor(fields, `atakSettings.${choice.name}`)"
          />
        </v-col>
      </v-row>
      <v-btn v-if="editable" color="primary" class="mb-4" :disabled="!dirty" :loading="saving" @click="save">Save</v-btn>

      <div class="d-flex align-center flex-wrap ga-2">
        <span class="text-body-medium">
          <template v-if="configuration.atakPreferenceFile !== null">
            Preference file: {{ configuration.atakPreferenceFile.fileName }}
            ({{ configuration.atakPreferenceFile.entries.length }} settings)
          </template>
          <template v-else>No preference file</template>
        </span>
        <template v-if="editable">
          <v-btn size="small" variant="outlined" :loading="uploading" @click="fileInput?.click()">
            {{ configuration.atakPreferenceFile === null ? "Upload .pref file" : "Replace" }}
          </v-btn>
          <v-btn
            v-if="configuration.atakPreferenceFile !== null"
            size="small"
            variant="text"
            :disabled="uploading"
            @click="replaceFile(null)"
          >
            Remove
          </v-btn>
          <input ref="fileInput" type="file" accept=".pref,.xml" hidden @change="onFileChosen">
        </template>
        <InfoHint
          v-if="removedKeys.length > 0"
          tone="warning"
          label="Settings left out of the file"
          :text="`Left out because OpenMeshTak sets them for each member: ${removedKeys.join(', ')}.`"
        />
      </div>
      <div v-for="message in messagesFor(fields, 'content')" :key="message" class="text-error text-body-small mt-2">
        {{ message }}
      </div>
    </template>
  </v-card>
</template>
