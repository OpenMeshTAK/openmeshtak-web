<script setup lang="ts">
import { mdiCalendarOutline, mdiClose, mdiEarth, mdiPencil, mdiPlus } from "@mdi/js";
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

function addEvent(eventId: string): void {
  addedEventIds.value.push(eventId);
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
    <div class="scope-list">
      <div v-for="scope in scopes" :key="scope.eventId ?? 'all'" class="scope-row">
        <v-avatar :color="scope.eventId === null ? 'primary' : undefined" variant="tonal" rounded="lg" size="36">
          <v-icon :icon="scope.eventId === null ? mdiEarth : mdiCalendarOutline" size="20" />
        </v-avatar>
        <div class="scope-row__text">
          <div class="text-body-large">{{ scope.name }}</div>
          <div class="text-body-small text-medium-emphasis">{{ scope.description }}</div>
        </div>
        <v-chip size="small" label variant="tonal" :color="permissionsFor(scope.eventId).length > 0 ? 'primary' : undefined">
          {{ countLabel(scope.eventId) }}
        </v-chip>
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
    </div>

    <v-menu v-if="!disabled && addableEvents.length > 0" max-height="320">
      <template #activator="{ props: menu }">
        <v-btn v-bind="menu" variant="text" color="primary" :prepend-icon="mdiPlus" class="mt-2">Add permissions for one event</v-btn>
      </template>
      <v-list density="compact">
        <v-list-item v-for="event in addableEvents" :key="event.id" :title="event.name" :prepend-icon="mdiCalendarOutline" @click="addEvent(event.id)" />
      </v-list>
    </v-menu>

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
.scope-list {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
}
.scope-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 14px;
}
.scope-row + .scope-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.scope-row__text {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
