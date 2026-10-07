<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { messagesFor } from "@/shared/errors/field-errors";
import type { GroupProvisioning } from "../event-groups.api";
import { takRoleOptions, takTeamOptions } from "../provisioning-options";

defineProps<{ errors: Record<string, string> }>();
// Field-error keys from Core look like `provisioning.tak.team`.
const provisioning = defineModel<GroupProvisioning>({ required: true });
</script>

<template>
  <div class="text-subtitle-2 mb-2">Callsign and Meshtastic name</div>
  <v-text-field
    v-model="provisioning.callsignFormat"
    label="Callsign format"
    class="mb-2"
    :error-messages="messagesFor(errors, 'provisioning.callsignFormat')"
  >
    <template #append-inner>
      <InfoHint label="About callsign format" text="Use {username} and optionally {group}, e.g. {username} [Bravo]" />
    </template>
  </v-text-field>
  <v-text-field
    :model-value="provisioning.shortNamePrefix ?? ''"
    label="Short-name prefix"
    class="mb-4"
    :error-messages="messagesFor(errors, 'provisioning.shortNamePrefix')"
    @update:model-value="provisioning.shortNamePrefix = $event.trim().toUpperCase() || null"
  >
    <template #append-inner>
      <InfoHint label="About short-name prefix" text="1–3 uppercase letters or digits; members become B1, B2, … Unique within the event." />
    </template>
  </v-text-field>

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
  <!--
    TAK server groups stay in the API but have no field here: the built-in TAK server ignores them,
    so the field only confused administrators. Saving keeps whatever the API already stored.
  -->
</template>
