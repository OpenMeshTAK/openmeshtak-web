<script setup lang="ts">
import { mdiDelete, mdiPlus } from "@mdi/js";
import { permissionCatalog } from "@/shared/api/permissions";
import type { Schemas } from "@/shared/api/types";

type Grant = Schemas["PermissionGrantDto"];

defineProps<{ events: { id: string; name: string }[]; disabled?: boolean }>();
const grants = defineModel<Grant[]>({ required: true });

const INSTANCE = "__instance__";

function scopeOf(grant: Grant): string {
  return grant.eventId ?? INSTANCE;
}

function setScope(index: number, scope: string): void {
  const grant = grants.value[index];
  if (grant !== undefined) {
    grant.eventId = scope === INSTANCE ? null : scope;
  }
}

function add(): void {
  grants.value.push({ permission: "events.read", eventId: null });
}

function remove(index: number): void {
  grants.value.splice(index, 1);
}
</script>

<template>
  <div>
    <div v-for="(grant, index) in grants" :key="index" class="d-flex flex-wrap align-center ga-3 mb-1">
      <v-select
        v-model="grant.permission"
        :items="permissionCatalog"
        label="Permission"
        :disabled="disabled"
        hide-details
        style="min-width: 220px; flex: 1"
      />
      <v-select
        :model-value="scopeOf(grant)"
        :items="[{ id: INSTANCE, name: 'All events (instance-wide)' }, ...events]"
        item-title="name"
        item-value="id"
        label="Scope"
        :disabled="disabled"
        hide-details
        style="min-width: 220px; flex: 1"
        @update:model-value="setScope(index, $event)"
      />
      <v-btn :icon="mdiDelete" variant="text" :disabled="disabled" aria-label="Remove permission" @click="remove(index)" />
    </div>
    <v-btn v-if="!disabled" variant="text" :prepend-icon="mdiPlus" class="mt-2" @click="add">Add permission</v-btn>
  </div>
</template>
