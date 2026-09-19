<script setup lang="ts">
import { ref, toRaw, watch } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import {
  createChannel,
  toUpdateRequest,
  updateChannel,
  type ChannelAudience,
  type MeshtasticChannelDto,
} from "../meshtastic-channels.api";
import { positionPrecisionOptions } from "../position-precision";
import AudiencePicker, { type AudienceOption } from "./AudiencePicker.vue";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  eventId: string;
  /** `null` adds a new channel. */
  channel: MeshtasticChannelDto | null;
  /** Whether this channel is, or as the first channel would become, the primary channel. */
  primary: boolean;
  groups: AudienceOption[];
  roles: AudienceOption[];
  members: AudienceOption[] | null;
}>();
const emit = defineEmits<{ saved: [channel: MeshtasticChannelDto] }>();

function emptyAudience(): ChannelAudience {
  return { groupIds: [], roleIds: [], memberIds: [] };
}

function initialForm() {
  // The channel comes from reactive state and structuredClone cannot copy Vue proxies.
  const channel = props.channel === null ? null : structuredClone(toRaw(props.channel));
  return {
    name: channel?.name ?? "",
    uplinkEnabled: channel?.uplinkEnabled ?? false,
    downlinkEnabled: channel?.downlinkEnabled ?? false,
    positionPrecision: channel?.positionPrecision ?? 0,
    audience: channel?.audience ?? emptyAudience(),
    secret: channel?.secret ?? false,
    keyHolders: channel?.keyHolders ?? emptyAudience(),
    psk: "",
  };
}

const form = ref(initialForm());
const saving = ref(false);
const formError = ref<string | null>(null);
const formFields = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (isOpen) {
    form.value = initialForm();
    formError.value = null;
    formFields.value = {};
  }
});

async function save(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const { psk, ...settings } = form.value;
  // Key holders exist only for secret channels; Core rejects them otherwise.
  const body = { ...settings, keyHolders: settings.secret ? settings.keyHolders : emptyAudience() };
  try {
    const saved =
      props.channel === null
        ? await createChannel(props.eventId, { ...body, ...(psk.trim() ? { psk: psk.trim() } : {}) })
        : await updateChannel(props.eventId, props.channel.id, {
            ...toUpdateRequest(props.channel),
            ...body,
          });
    open.value = false;
    emit("saved", saved);
  } catch (caught: unknown) {
    formFields.value = fieldErrors(caught);
    formError.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card class="pa-2">
      <v-card-title>{{ channel ? `Edit channel ${channel.name}` : "Add channel" }}</v-card-title>
      <v-card-text>
        <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
        <v-text-field
          v-model="form.name"
          label="Name"
          counter="11"
          hint="Up to 11 letters, digits, - or _"
          persistent-hint
          class="mb-2"
          :error-messages="messagesFor(formFields, 'name')"
        />
        <v-text-field
          v-if="channel === null"
          v-model="form.psk"
          label="Existing key (optional)"
          hint="Leave empty to generate a new random key. Otherwise paste the base64 key."
          persistent-hint
          autocomplete="off"
          class="mb-2"
          :error-messages="messagesFor(formFields, 'psk')"
        />

        <div class="text-subtitle-2 mt-2 mb-1">MQTT and position</div>
        <v-switch v-model="form.uplinkEnabled" label="Uplink to MQTT" color="primary" hide-details />
        <v-switch v-model="form.downlinkEnabled" label="Downlink from MQTT" color="primary" hide-details />
        <v-select
          v-model="form.positionPrecision"
          :items="positionPrecisionOptions"
          label="Position sharing"
          class="mt-2"
        />

        <div class="text-subtitle-2 mb-1">Audience</div>
        <v-alert v-if="primary" type="info" variant="tonal" density="compact" class="mb-2">
          The primary channel always reaches every member.
        </v-alert>
        <AudiencePicker
          v-else
          v-model="form.audience"
          :groups="groups"
          :roles="roles"
          :members="members"
          :errors="messagesFor(formFields, 'audience.groupIds')"
        />

        <div class="text-subtitle-2 mb-1">Secrecy</div>
        <v-switch
          v-model="form.secret"
          label="Secret channel"
          color="primary"
          hint="Only key holders receive the key before release; they share it on site. This can also apply to the primary channel."
          persistent-hint
          :error-messages="messagesFor(formFields, 'secret')"
        />
        <template v-if="form.secret">
          <div class="text-body-2 text-medium-emphasis mt-3 mb-2">
            Key holders, for example platoon leaders. Only key holders who are also in the audience
            receive the channel.
          </div>
          <AudiencePicker v-model="form.keyHolders" :groups="groups" :roles="roles" :members="members" />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
