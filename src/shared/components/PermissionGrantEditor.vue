<script setup lang="ts">
import { mdiClose, mdiPlus } from "@mdi/js";
import { computed, ref } from "vue";
import type { Permission, Schemas } from "@/shared/api/types";
import PermissionTree from "./PermissionTree.vue";

type Grant = Schemas["PermissionGrantDto"];

/**
 * Edits Core's flat grant list as one permission tree per scope: an "All events" block plus one
 * block per event the grants are limited to. Mixed scopes such as `users.read` everywhere and
 * `members.sync` for one event therefore stay visible and editable.
 */
const props = defineProps<{ events: { id: string; name: string }[]; disabled?: boolean }>();
const grants = defineModel<Grant[]>({ required: true });

/** Event blocks the user added that have no grants yet. */
const addedEventIds = ref<string[]>([]);
const eventToAdd = ref<string | null>(null);

const eventBlocks = computed(() => {
  const ids = new Set([
    ...grants.value.flatMap(({ eventId }) => (eventId === null ? [] : [eventId])),
    ...addedEventIds.value,
  ]);
  return [...ids].map((id) => ({ id, name: props.events.find((event) => event.id === id)?.name ?? "Unknown event" }));
});

const addableEvents = computed(() =>
  props.events.filter(({ id }) => !eventBlocks.value.some((block) => block.id === id)),
);

function permissionsFor(eventId: string | null): Permission[] {
  return grants.value.filter((grant) => grant.eventId === eventId).map(({ permission }) => permission);
}

function setPermissions(eventId: string | null, permissions: Permission[]): void {
  grants.value = [
    ...grants.value.filter((grant) => grant.eventId !== eventId),
    ...permissions.map((permission) => ({ permission, eventId })),
  ];
}

function addEventBlock(): void {
  if (eventToAdd.value !== null) {
    addedEventIds.value.push(eventToAdd.value);
    eventToAdd.value = null;
  }
}

function removeEventBlock(eventId: string): void {
  addedEventIds.value = addedEventIds.value.filter((id) => id !== eventId);
  setPermissions(eventId, []);
}
</script>

<template>
  <div>
    <v-card variant="outlined" class="px-3 py-2 mb-3">
      <div class="text-subtitle-2">All events</div>
      <div class="text-caption text-medium-emphasis mb-1">Applies to the whole installation and every event.</div>
      <PermissionTree
        :model-value="permissionsFor(null)"
        :event-scoped="false"
        :disabled="disabled"
        @update:model-value="setPermissions(null, $event)"
      />
    </v-card>

    <v-card v-for="block in eventBlocks" :key="block.id" variant="outlined" class="px-3 py-2 mb-3">
      <div class="d-flex align-center">
        <div class="flex-grow-1">
          <div class="text-subtitle-2">{{ block.name }}</div>
          <div class="text-caption text-medium-emphasis mb-1">Applies only to this event.</div>
        </div>
        <v-btn
          v-if="!disabled"
          :icon="mdiClose"
          variant="text"
          size="small"
          :aria-label="`Remove permissions for ${block.name}`"
          @click="removeEventBlock(block.id)"
        />
      </div>
      <PermissionTree
        :model-value="permissionsFor(block.id)"
        event-scoped
        :disabled="disabled"
        @update:model-value="setPermissions(block.id, $event)"
      />
    </v-card>

    <div v-if="!disabled && addableEvents.length > 0" class="d-flex ga-2 align-center">
      <v-select
        v-model="eventToAdd"
        :items="addableEvents"
        item-title="name"
        item-value="id"
        label="Limit permissions to an event"
        density="compact"
        hide-details
        style="max-width: 320px"
      />
      <v-btn variant="tonal" :prepend-icon="mdiPlus" :disabled="eventToAdd === null" @click="addEventBlock">
        Add event permissions
      </v-btn>
    </div>
  </div>
</template>
