<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiCheckDecagram, mdiChip, mdiOpenInNew } from "@mdi/js";
import { computed, ref } from "vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
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

const dialogOpen = ref(false);
const line = ref("");
const patch = ref("");
const busy = ref(false);
const formError = ref<string | null>(null);
/** Second dialog step: the server's dry-run report waiting for confirmation. */
const preview = ref<FirmwareChangePreviewDto | null>(null);

const facts = computed(() => [
  { label: "Minimum version", value: props.configuration.effectiveMinimumVersion ?? "Not supported" },
  { label: "Tested on", value: props.profile?.testedVersions.join(", ") || "No device yet" },
  { label: "Release channel", value: props.profile ? capitalize(props.profile.channel) : "—" },
]);
const lineOptions = computed(() =>
  props.profiles.map((option) => ({
    value: option.line,
    title: `Meshtastic ${option.line}`,
    subtitle: `${capitalize(option.channel)} · from ${option.minVersion}${option.default ? " · default" : ""}`,
  })),
);
const target = computed(() => (patch.value.trim() === "" ? line.value : `${line.value}.${patch.value.trim()}`));
const reportRows = computed(() => {
  const report = preview.value?.report;
  return report === undefined
    ? []
    : [
        { title: "Kept", color: "success", keys: report.kept },
        { title: "Removed", color: "error", keys: report.dropped },
        { title: "Reset to the default", color: "warning", keys: report.invalid },
        { title: "Added with defaults", color: "info", keys: report.added },
      ].filter(({ keys }) => keys.length > 0);
});

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function label(key: string): string {
  return props.profile?.fields.find((field) => field.key === key)?.label ?? key;
}

function openDialog(): void {
  const [major, minor, minimumPatch] = props.configuration.firmwareVersion.split(".");
  line.value = `${major ?? ""}.${minor ?? ""}`;
  patch.value = minimumPatch ?? "";
  formError.value = null;
  preview.value = null;
  dialogOpen.value = true;
}

async function review(): Promise<void> {
  busy.value = true;
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
    busy.value = false;
  }
}

async function apply(confirmed: FirmwareChangePreviewDto): Promise<void> {
  busy.value = true;
  try {
    const updated = await changeFirmware(
      props.eventId,
      props.configuration.version,
      confirmed.firmwareVersion,
      confirmed.confirmation,
    );
    dialogOpen.value = false;
    toast.success(`The event now targets Meshtastic ${updated.firmwareVersion}.`);
    emit("changed", updated);
  } catch (caught: unknown) {
    formError.value = describeError(caught);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <SectionHeader
      title="Firmware"
      description="Participants are asked to flash this firmware before importing their settings. Settings that need a newer patch appear once you raise the minimum version."
    >
      <template #actions>
        <v-btn v-if="editable" variant="tonal" @click="openDialog">Change firmware</v-btn>
      </template>
    </SectionHeader>

    <v-card class="pa-5">
      <div class="d-flex align-center ga-4 flex-wrap">
        <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
          <v-icon :icon="mdiChip" />
        </v-avatar>
        <div class="flex-grow-1">
          <div class="text-title-large font-weight-medium">Meshtastic {{ configuration.firmwareVersion }}</div>
          <div class="d-flex align-center ga-2 mt-1 flex-wrap">
            <v-chip
              v-if="configuration.verified"
              size="small"
              variant="tonal"
              label
              color="success"
              :prepend-icon="mdiCheckDecagram"
            >
              Tested on a device
            </v-chip>
            <v-chip v-if="profile && profile.channel !== 'stable'" size="small" variant="tonal" label color="warning">
              {{ capitalize(profile.channel) }} firmware
            </v-chip>
          </div>
        </div>
        <v-btn
          v-if="profile"
          :href="profile.flasherUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          :append-icon="mdiOpenInNew"
        >
          Meshtastic flasher
        </v-btn>
      </div>

      <v-divider class="my-4" />

      <dl class="firmware-facts">
        <div v-for="fact in facts" :key="fact.label">
          <dt class="text-body-small text-medium-emphasis">{{ fact.label }}</dt>
          <dd class="text-body-large">{{ fact.value }}</dd>
        </div>
      </dl>
      <p v-if="profile?.flashingNotes" class="text-body-medium text-medium-emphasis mt-4 mb-0">{{ profile.flashingNotes }}</p>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="600" scrollable>
      <v-card class="pa-2">
        <v-card-title>{{ preview ? `Review the switch to ${preview.firmwareVersion}` : "Change firmware" }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>

          <template v-if="preview === null">
            <v-select v-model="line" :items="lineOptions" label="Firmware line" item-props class="mb-2" />
            <v-text-field
              v-model="patch"
              label="Minimum patch (optional)"
              :prefix="`${line}.`"
              inputmode="numeric"
            >
              <template #append-inner>
                <InfoHint label="About minimum patch" text="Leave empty for the line's minimum. A higher patch unlocks settings added in it." />
              </template>
            </v-text-field>
          </template>

          <template v-else>
            <p class="text-body-medium mt-0 mb-4">
              Settings are checked against Meshtastic {{ preview.firmwareVersion }} (at least
              {{ preview.effectiveMinimumVersion }}). Members need new device files after the next
              publication.
            </p>
            <div v-for="row in reportRows" :key="row.title" class="mb-4">
              <div class="text-title-small mb-2">{{ row.title }} · {{ row.keys.length }}</div>
              <div class="d-flex flex-wrap ga-1">
                <v-chip v-for="key in row.keys" :key="key" :color="row.color" size="small" variant="tonal" label>
                  {{ label(key) }}
                </v-chip>
              </div>
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="preview" variant="text" :disabled="busy" @click="preview = null">Back</v-btn>
          <v-spacer />
          <v-btn variant="text" :disabled="busy" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn
            v-if="preview === null"
            color="primary"
            :disabled="target === configuration.firmwareVersion"
            :loading="busy"
            @click="review"
          >
            Continue
          </v-btn>
          <v-btn v-else color="primary" :loading="busy" @click="apply(preview)">Apply change</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.firmware-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin: 0;
}
.firmware-facts dd {
  margin: 0;
}
</style>
