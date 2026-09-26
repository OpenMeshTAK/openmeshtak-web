<script setup lang="ts">
import { mdiCellphoneLink, mdiServerOff, mdiServerNetwork } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { listChannels, type MeshtasticChannelDto } from "@/modules/meshtastic-channels/meshtastic-channels.api";
import {
  getTakConfiguration,
  updateTakConfiguration,
  type TakConfigurationDto,
  type TakConnectionMode,
} from "./tak-configuration.api";

/**
 * How participants connect ATAK/iTAK. The Meshtastic app's local TAK server creates its own
 * certificates on the phone, so OpenMeshTak only chooses the mode and the mesh channel and guides
 * participants; it cannot hand out a ready-made connection.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

const configuration = ref<TakConfigurationDto | null>(null);
const channels = ref<MeshtasticChannelDto[]>([]);
const mode = ref<TakConnectionMode>("none");
const meshChannelId = ref<string | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const saving = ref(false);
const fields = ref<Record<string, string>>({});

const modes: Array<{ value: TakConnectionMode; title: string; subtitle: string; icon: string }> = [
  { value: "none", title: "No TAK guidance", subtitle: "Participants connect TAK on their own.", icon: mdiServerOff },
  {
    value: "meshtastic-local-server",
    title: "Meshtastic app local TAK server",
    subtitle: "ATAK or iTAK on the phone connects to the Meshtastic app, which carries TAK over the mesh.",
    icon: mdiCellphoneLink,
  },
  {
    value: "built-in-server",
    title: "OpenMeshTak TAK server",
    subtitle: "ATAK or iTAK enroll from the dashboard and connect to the built-in TAK server over the internet.",
    icon: mdiServerNetwork,
  },
];

const channelOptions = computed(() => [
  { value: null, title: "Primary channel" },
  ...channels.value.filter((channel) => !channel.primary).map((channel) => ({ value: channel.id, title: channel.name })),
]);
const dirty = computed(
  () =>
    configuration.value !== null &&
    (configuration.value.mode !== mode.value || configuration.value.meshChannelId !== meshChannelId.value),
);

function show(loaded: TakConfigurationDto): void {
  configuration.value = loaded;
  mode.value = loaded.mode;
  meshChannelId.value = loaded.meshChannelId;
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loaded, loadedChannels] = await Promise.all([getTakConfiguration(props.eventId), listChannels(props.eventId)]);
    channels.value = loadedChannels;
    show(loaded);
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
  fields.value = {};
  try {
    show(
      await updateTakConfiguration(props.eventId, {
        version: configuration.value.version,
        mode: mode.value,
        meshChannelId: mode.value === "none" ? null : meshChannelId.value,
      }),
    );
    toast.success("TAK connection saved.");
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <SectionHeader
      title="TAK connection"
      description="How participants connect ATAK or iTAK. Participants get step-by-step instructions with this event's values on their dashboard."
    />

    <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line@2" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />

    <template v-else>
      <v-card class="mb-4">
        <v-radio-group v-model="mode" hide-details :disabled="!editable">
          <v-list lines="two" class="py-0">
            <template v-for="(option, index) in modes" :key="option.value">
              <v-divider v-if="index > 0" />
              <v-list-item :prepend-icon="option.icon" :title="option.title" :subtitle="option.subtitle" @click="editable && (mode = option.value)">
                <template #append>
                  <v-radio :value="option.value" :aria-label="option.title" />
                </template>
              </v-list-item>
            </template>
          </v-list>
        </v-radio-group>
      </v-card>

      <v-card v-if="mode === 'meshtastic-local-server'" class="pa-5 mb-4">
        <v-select
          v-model="meshChannelId"
          :items="channelOptions"
          label="TAK mesh channel"
          hint="The channel the app sends TAK traffic on. Members who do not receive it use the primary channel."
          persistent-hint
          :disabled="!editable"
          :error-messages="messagesFor(fields, 'meshChannelId')"
        />
        <v-alert type="info" density="compact" class="mt-4">
          The app creates the TAK certificates on each phone, so participants export the TAK Data
          Package from the Meshtastic app themselves. This setup has not been tested on a device yet.
        </v-alert>
      </v-card>

      <v-btn v-if="editable" color="primary" :disabled="!dirty" :loading="saving" @click="save">Save</v-btn>
    </template>
  </div>
</template>
