<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import {
  changeFirmware,
  previewFirmwareChange,
  type FirmwareChangePreviewDto,
  type FirmwareProfileDto,
  type FirmwareProfileSummaryDto,
  type MeshtasticConfigurationDto,
} from "../meshtastic-configuration.api";

const props = defineProps<{
  eventId: string;
  editable: boolean;
  configuration: MeshtasticConfigurationDto;
  profile: FirmwareProfileDto | null;
  profiles: FirmwareProfileSummaryDto[];
}>();
const emit = defineEmits<{ changed: [configuration: MeshtasticConfigurationDto] }>();
const toast = useToast();

const line = ref("");
const patch = ref("");
const checking = ref(false);
const applying = ref(false);
const formError = ref<string | null>(null);
const preview = ref<FirmwareChangePreviewDto | null>(null);

watch(
  () => props.configuration.firmwareVersion,
  (version) => {
    const [major, minor, minimumPatch] = version.split(".");
    line.value = `${major ?? ""}.${minor ?? ""}`;
    patch.value = minimumPatch ?? "";
  },
  { immediate: true },
);

const lineOptions = computed(() =>
  props.profiles.map((profile) => ({
    value: profile.line,
    title: `${profile.line}.x${profile.channel === "stable" ? "" : ` (${profile.channel})`}${profile.default ? " · default" : ""}`,
  })),
);
const target = computed(() => (patch.value.trim() === "" ? line.value : `${line.value}.${patch.value.trim()}`));
const unchanged = computed(() => target.value === props.configuration.firmwareVersion);

function label(key: string): string {
  return props.profile?.fields.find((field) => field.key === key)?.label ?? key;
}

const reportRows = computed(() => {
  const report = preview.value?.report;
  if (report === undefined) {
    return [];
  }
  return [
    { title: "Kept", color: "success", keys: report.kept },
    { title: "Dropped", color: "error", keys: report.dropped },
    { title: "Reset to default (invalid)", color: "warning", keys: report.invalid },
    { title: "Added with default", color: "info", keys: report.added },
  ].filter(({ keys }) => keys.length > 0);
});

async function check(): Promise<void> {
  checking.value = true;
  formError.value = null;
  try {
    const result = await previewFirmwareChange(props.eventId, target.value);
    if (result.confirmation === null) {
      // Raising the minimum patch within a line never drops values, so it applies directly.
      await apply(result);
    } else {
      preview.value = result;
    }
  } catch (caught: unknown) {
    formError.value = Object.values(fieldErrors(caught))[0] ?? describeError(caught);
  } finally {
    checking.value = false;
  }
}

async function apply(confirmed: FirmwareChangePreviewDto): Promise<void> {
  applying.value = true;
  try {
    const updated = await changeFirmware(
      props.eventId,
      props.configuration.version,
      confirmed.firmwareVersion,
      confirmed.confirmation,
    );
    preview.value = null;
    toast.success(`The event now targets Meshtastic ${updated.firmwareVersion}.`);
    emit("changed", updated);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <div>
    <div class="text-h6 mb-1">Firmware</div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Participants are asked to flash this firmware before they import their settings. Fields
      that need a newer patch stay hidden until you raise the minimum version.
    </p>

    <v-card variant="outlined" class="pa-4 mb-6">
      <div class="d-flex align-center flex-wrap ga-2 mb-2">
        <span class="text-h5">Meshtastic {{ configuration.firmwareVersion }}</span>
        <v-chip v-if="profile && profile.channel !== 'stable'" size="small" color="warning" variant="tonal" label>
          {{ profile.channel }}
        </v-chip>
        <v-chip v-if="!configuration.verified" size="small" color="warning" variant="tonal" label>
          Not verified
        </v-chip>
      </div>
      <div class="text-body-2">
        At least {{ configuration.effectiveMinimumVersion ?? "—" }}
        <span v-if="profile"> · tested {{ profile.testedVersions.join(", ") || "on no device yet" }}</span>
      </div>
      <div v-if="profile?.flashingNotes" class="text-body-2 text-medium-emphasis mt-2">{{ profile.flashingNotes }}</div>
      <v-btn
        v-if="profile"
        :href="profile.flasherUrl"
        target="_blank"
        rel="noopener noreferrer"
        variant="text"
        class="mt-2 px-0"
      >
        Open the Meshtastic flasher
      </v-btn>
    </v-card>

    <template v-if="editable">
      <div class="text-subtitle-1 font-weight-medium mb-2">Change the recommended firmware</div>
      <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
      <v-row dense>
        <v-col cols="12" sm="6">
          <v-select v-model="line" :items="lineOptions" label="Firmware line" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="patch"
            label="Minimum patch (optional)"
            hint="For example 3 for 2.8.3. Empty uses the profile minimum."
            persistent-hint
            inputmode="numeric"
          />
        </v-col>
      </v-row>
      <v-btn color="primary" class="mt-2" :disabled="unchanged" :loading="checking" @click="check">
        Check change
      </v-btn>
    </template>

    <v-dialog :model-value="preview !== null" max-width="640" scrollable @update:model-value="preview = null">
      <v-card v-if="preview" class="pa-2">
        <v-card-title>Switch to Meshtastic {{ preview.firmwareVersion }}?</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">
            Settings are checked against the {{ preview.firmwareVersion }} profile (at least
            {{ preview.effectiveMinimumVersion }}). Already generated device files keep their old
            settings until members download them again after the next publication.
          </p>
          <div v-for="row in reportRows" :key="row.title" class="mb-3">
            <div class="text-subtitle-2 mb-1">{{ row.title }} ({{ row.keys.length }})</div>
            <div class="d-flex flex-wrap ga-1">
              <v-chip v-for="key in row.keys" :key="key" :color="row.color" size="small" variant="tonal" label>
                {{ label(key) }}
              </v-chip>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="preview = null">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="applying" @click="apply(preview)">Apply change</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
