<script setup lang="ts">
import { mdiClose, mdiPencil, mdiPlus } from "@mdi/js";
import { computed, ref } from "vue";
import type { Permission, Schemas } from "@/shared/api/types";
import PermissionScopeDialog from "./PermissionScopeDialog.vue";

type Grant = Schemas["PermissionGrantDto"];

interface Scope {
  eventId: string | null;
  name: string;
  description: string;
}

/**
 * Edits Core's flat grant list as one row per scope: "All events" plus one row per event the grants
 * are limited to. Each row opens its own permission-tree dialog, so mixed scopes such as
 * `users.read` everywhere and `members.sync` for one event stay visible without a long form.
 */
const props = defineProps<{
  events: { id: string; name: string }[];
  disabled?: boolean;
}>();
const grants = defineModel<Grant[]>({ required: true });

/** Event rows the user added that have no grants yet. */
const addedEventIds = ref<string[]>([]);
const eventToAdd = ref<string | null>(null);
const editing = ref<Scope | null>(null);
const dialogOpen = ref(false);

const allEvents: Scope = {
  eventId: null,
  name: "All events",
  description: "Applies to the whole installation and every event.",
};

const eventScopes = computed<Scope[]>(() => {
  const ids = new Set([
    ...grants.value.flatMap(({ eventId }) => (eventId === null ? [] : [eventId])),
    ...addedEventIds.value,
  ]);
  return [...ids].map((id) => ({
    eventId: id,
    name: props.events.find((event) => event.id === id)?.name ?? "Unknown event",
    description: "Applies only to this event.",
  }));
});

const scopes = computed(() => [allEvents, ...eventScopes.value]);

const addableEvents = computed(() =>
  props.events.filter(({ id }) => !eventScopes.value.some((scope) => scope.eventId === id)),
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

function countLabel(eventId: string | null): string {
  const count = permissionsFor(eventId).length;
  return count === 1 ? "1 permission" : `${count} permissions`;
}

function edit(scope: Scope): void {
  editing.value = scope;
  dialogOpen.value = true;
}

function addEvent(): void {
  if (eventToAdd.value === null) return;
  const eventId = eventToAdd.value;
  addedEventIds.value.push(eventId);
  eventToAdd.value = null;
  const scope = eventScopes.value.find((candidate) => candidate.eventId === eventId);
  if (scope) edit(scope);
}

function removeEvent(eventId: string): void {
  addedEventIds.value = addedEventIds.value.filter((id) => id !== eventId);
  setPermissions(eventId, []);
}
</script>

<template>
  <div>
    <div v-for="scope in scopes" :key="scope.eventId ?? 'all'" class="scope-row">
      <div class="flex-grow-1">
        <div class="text-subtitle-2">{{ scope.name }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ scope.description }}
        </div>
      </div>
      <span class="text-body-2 text-medium-emphasis">{{ countLabel(scope.eventId) }}</span>
      <v-btn variant="tonal" size="small" :prepend-icon="mdiPencil" @click="edit(scope)">
        {{ disabled ? "View" : "Edit" }}
      </v-btn>
      <v-btn
        v-if="!disabled && scope.eventId !== null"
        :icon="mdiClose"
        variant="text"
        size="small"
        :aria-label="`Remove permissions for ${scope.name}`"
        @click="removeEvent(scope.eventId)"
      />
    </div>

    <div v-if="!disabled && addableEvents.length > 0" class="d-flex ga-2 align-center mt-3">
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
      <v-btn variant="tonal" :prepend-icon="mdiPlus" :disabled="eventToAdd === null" @click="addEvent">
        Add event permissions
      </v-btn>
    </div>

    <PermissionScopeDialog
      v-if="editing"
      v-model:open="dialogOpen"
      :model-value="permissionsFor(editing.eventId)"
      :title="editing.name"
      :subtitle="editing.description"
      :event-scoped="editing.eventId !== null"
      :disabled="disabled"
      @update:model-value="setPermissions(editing.eventId, $event)"
    />
  </div>
</template>

<style scoped>
.scope-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
