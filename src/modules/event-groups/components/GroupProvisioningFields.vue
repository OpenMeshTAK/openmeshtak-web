<script setup lang="ts">
import { messagesFor } from "@/shared/errors/field-errors";
import type { GroupProvisioning } from "../event-groups.api";
import { deviceRoleOptions, takRoleOptions, takTeamOptions } from "../provisioning-options";

defineProps<{ errors: Record<string, string> }>();
// Field-error keys from Core look like `provisioning.tak.team`.
const provisioning = defineModel<GroupProvisioning>({ required: true });
</script>

<template>
  <div class="text-subtitle-2 mb-2">Callsign and Meshtastic name</div>
  <v-text-field
    v-model="provisioning.callsignFormat"
    label="Callsign format"
    hint="Use {username} and optionally {group}, e.g. {username} [Bravo]"
    persistent-hint
    class="mb-2"
    :error-messages="messagesFor(errors, 'provisioning.callsignFormat')"
  />
  <v-text-field
    :model-value="provisioning.shortNamePrefix ?? ''"
    label="Short-name prefix"
    hint="1–3 uppercase letters or digits; members become B1, B2, … Unique within the event."
    persistent-hint
    class="mb-4"
    :error-messages="messagesFor(errors, 'provisioning.shortNamePrefix')"
    @update:model-value="provisioning.shortNamePrefix = $event.trim().toUpperCase() || null"
  />

  <div class="text-subtitle-2 mb-2">TAK</div>
  <div class="d-flex flex-wrap ga-4">
    <v-select
      v-model="provisioning.tak.team"
      :items="takTeamOptions"
      label="Team color"
      style="min-width: 200px"
      :error-messages="messagesFor(errors, 'provisioning.tak.team')"
    />
    <v-select
      v-model="provisioning.tak.role"
      :items="takRoleOptions"
      label="TAK role"
      style="min-width: 200px"
      :error-messages="messagesFor(errors, 'provisioning.tak.role')"
    />
  </div>
  <v-combobox
    v-model="provisioning.tak.serverGroups"
    label="TAK server groups"
    multiple
    chips
    closable-chips
    variant="outlined"
    density="comfortable"
    hint="Press Enter after each group"
    persistent-hint
    class="mb-4"
    :error-messages="messagesFor(errors, 'provisioning.tak.serverGroups')"
  />

  <div class="text-subtitle-2 mb-2">Meshtastic</div>
  <v-select
    v-model="provisioning.meshtastic.deviceRole"
    :items="deviceRoleOptions"
    label="Device role"
    :error-messages="messagesFor(errors, 'provisioning.meshtastic.deviceRole')"
    class="mb-2"
  />

  <div class="text-subtitle-2 mb-2">Mission content</div>
  <v-combobox
    v-model="provisioning.missionGroups"
    label="Mission groups"
    multiple
    chips
    closable-chips
    variant="outlined"
    density="comfortable"
    :error-messages="messagesFor(errors, 'provisioning.missionGroups')"
  />
</template>
