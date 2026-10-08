<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { listChannels, type MeshtasticChannelDto } from "@/modules/meshtastic-channels/meshtastic-channels.api";
import { getTakConfiguration, updateTakConfiguration, type TakConfigurationDto } from "./tak-configuration.api";

/**
 * TAK over Meshtastic. In a Meshtastic event, ATAK/iTAK also connect to the Meshtastic app's local
 * TAK server; the app creates its own certificates on the phone, so OpenMeshTak only chooses the
 * mesh channel and guides participants. The built-in TAK server stays available whenever there is
 * network.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

const configuration = ref<TakConfigurationDto | null>(null);
const channels = ref<MeshtasticChannelDto[]>([]);
const meshChannelId = ref<string | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const saving = ref(false);
const fields = ref<Record<string, string>>({});

const channelOptions = computed(() => [
  { value: null, title: "Primary channel" },
  ...channels.value.filter((channel) => !channel.primary).map((channel) => ({ value: channel.id, title: channel.name })),
]);
const dirty = computed(() => configuration.value !== null && configuration.value.meshChannelId !== meshChannelId.value);

function show(loaded: TakConfigurationDto): void {
  configuration.value = loaded;
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
    show(await updateTakConfiguration(props.eventId, { version: configuration.value.version, meshChannelId: meshChannelId.value }));
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
      description="ATAK or iTAK connect to the Meshtastic app, which carries TAK over the mesh. Participants get step-by-step instructions with this event's values on their dashboard."
    />

    <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />

    <template v-else>
      <v-card class="pa-5 mb-4">
        <v-select
          v-model="meshChannelId"
          :items="channelOptions"
          label="TAK mesh channel"
          :disabled="!editable"
          :error-messages="messagesFor(fields, 'meshChannelId')"
        >
          <template #append-inner>
            <InfoHint label="About the TAK mesh channel" text="The channel the app sends TAK traffic on. Members who do not receive it use the primary channel." />
          </template>
        </v-select>
        <v-alert type="info" density="compact" class="mt-4">
          The app creates the TAK certificates on each phone, so participants export the TAK Data
          Package from the Meshtastic app themselves. Whenever there is network, their TAK app also
          uses the OpenMeshTak TAK server for Data Packages.
        </v-alert>
      </v-card>

      <v-btn v-if="editable" color="primary" :disabled="!dirty" :loading="saving" @click="save">Save</v-btn>
    </template>
  </div>
</template>
