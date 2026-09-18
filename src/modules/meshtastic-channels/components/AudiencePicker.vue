<script setup lang="ts">
import type { ChannelAudience } from "../meshtastic-channels.api";

export interface AudienceOption {
  id: string;
  title: string;
}

/** Selects any union of event groups, roles and individual members. */
const audience = defineModel<ChannelAudience>({ required: true });

defineProps<{
  groups: AudienceOption[];
  roles: AudienceOption[];
  /** `null` when the viewer may not list members; individual members are then not selectable. */
  members: AudienceOption[] | null;
  disabled?: boolean;
  errors?: string[];
}>();
</script>

<template>
  <div>
    <v-autocomplete
      v-model="audience.groupIds"
      :items="groups"
      item-value="id"
      label="Groups"
      multiple
      chips
      closable-chips
      :disabled="disabled ?? false"
      :error-messages="errors ?? []"
    />
    <v-autocomplete
      v-model="audience.roleIds"
      :items="roles"
      item-value="id"
      label="Roles"
      multiple
      chips
      closable-chips
      :disabled="disabled ?? false"
    />
    <v-autocomplete
      v-if="members !== null"
      v-model="audience.memberIds"
      :items="members"
      item-value="id"
      label="Individual members"
      multiple
      chips
      closable-chips
      :disabled="disabled ?? false"
    />
  </div>
</template>
