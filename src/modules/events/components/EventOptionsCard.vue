<script setup lang="ts">
import { computed, ref } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import TrafficRecordingOption from "@/modules/tak-server/components/TrafficRecordingOption.vue";
import { settingsFromEvent, settingsToRequest } from "../event-settings";
import { updateEvent, type EventDto } from "../events.api";

/**
 * Event-wide switches. Each one saves on its own, based on the stored event, so unsaved edits in
 * the settings form stay local. Changing whether new accounts are permanent is an account decision
 * and needs `event-accounts.manage`.
 */
const props = defineProps<{ event: EventDto; editable: boolean }>();
const emit = defineEmits<{ updated: [event: EventDto] }>();
const session = useSession();
const toast = useToast();

const canManageAccounts = computed(() => session.can("event-accounts.manage", props.event.id));
const saving = ref<"meshtasticEnabled" | "permanentAccounts" | null>(null);

async function save(option: "meshtasticEnabled" | "permanentAccounts", value: boolean | null): Promise<void> {
  saving.value = option;
  try {
    const updated = await updateEvent(props.event.id, {
      version: props.event.version,
      ...settingsToRequest(settingsFromEvent(props.event)),
      [option]: value === true,
    });
    emit("updated", updated);
    toast.success(
      option === "meshtasticEnabled"
        ? updated.meshtasticEnabled
          ? "This event now uses Meshtastic radios."
          : "This event is now TAK only."
        : updated.permanentAccounts
          ? "New accounts are now permanent users."
          : "New accounts are now event accounts.",
    );
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    saving.value = null;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="text-title-medium font-weight-medium mb-2">Options</div>

    <div class="d-flex align-center">
      <v-switch
        :model-value="event.meshtasticEnabled"
        label="Use Meshtastic radios"
        color="primary"
        inset
        hide-details
        :loading="saving === 'meshtasticEnabled'"
        :disabled="!editable || saving !== null"
        @update:model-value="save('meshtasticEnabled', $event)"
      />
      <InfoHint label="About Meshtastic radios" class="ml-2">
        <p class="mb-2">
          Participants get a radio setup and also connect their TAK app over the Meshtastic app, so TAK keeps working
          without network. The TAK server still delivers Data Packages whenever there is network.
        </p>
        <p class="mb-2">Turn it off for TAK-only events. Channels and radio settings stay saved for later.</p>
        <p>In an active event, participants get the change once you publish the configuration.</p>
      </InfoHint>
    </div>

    <div class="d-flex align-center">
      <v-switch
        :model-value="event.permanentAccounts"
        label="Create new accounts as permanent users"
        color="primary"
        inset
        hide-details
        :loading="saving === 'permanentAccounts'"
        :disabled="!editable || !canManageAccounts || saving !== null"
        @update:model-value="save('permanentAccounts', $event)"
      />
      <InfoHint label="About event accounts" class="ml-2">
        <p class="mb-2">
          People created directly for this event and participants synchronized from an integration get an
          <strong>event account</strong>. Archiving the event deletes those accounts.
        </p>
        <p>Turn this on to keep them as permanent users instead. Accounts that already exist do not change.</p>
      </InfoHint>
    </div>

    <TrafficRecordingOption v-if="session.can('tak-traffic.view', event.id)" :event-id="event.id" />
  </v-card>
</template>
