<script setup lang="ts">
import { permissionAreas, type PermissionArea } from "@/shared/api/permissions";
import type { Permission } from "@/shared/api/types";

/**
 * Checkbox tree for one scope: an area checkbox selects or clears all of its permissions, and each
 * row shows a readable label with the technical permission name.
 */
const props = defineProps<{ eventScoped: boolean; disabled?: boolean }>();
const selected = defineModel<Permission[]>({ required: true });

function isUnavailable(instanceOnly: boolean | undefined): boolean {
  return props.eventScoped && instanceOnly === true;
}

function available(area: PermissionArea): Permission[] {
  return area.permissions
    .filter(({ instanceOnly }) => !isUnavailable(instanceOnly))
    .map(({ permission }) => permission);
}

function areaState(area: PermissionArea): "all" | "some" | "none" {
  const options = available(area);
  const count = options.filter((permission) => selected.value.includes(permission)).length;
  return count === 0 ? "none" : count === options.length ? "all" : "some";
}

function toggleArea(area: PermissionArea): void {
  const options = available(area);
  const others = selected.value.filter((permission) => !options.includes(permission));
  selected.value = areaState(area) === "all" ? others : [...others, ...options];
}

function toggle(permission: Permission): void {
  selected.value = selected.value.includes(permission)
    ? selected.value.filter((item) => item !== permission)
    : [...selected.value, permission];
}
</script>

<template>
  <div class="permission-tree">
    <section v-for="area in permissionAreas" :key="area.prefix" class="py-0">
      <div class="permission-row">
        <v-checkbox-btn
          :model-value="areaState(area) === 'all'"
          :indeterminate="areaState(area) === 'some'"
          :disabled="disabled || available(area).length === 0"
          :aria-label="`All ${area.label} permissions`"
          density="compact"
          @update:model-value="toggleArea(area)"
        />
        <span class="permission-label text-body-medium font-weight-medium">{{ area.label }}</span>
        <code class="permission-name">{{ area.prefix }}</code>
      </div>
      <div
        v-for="entry in area.permissions"
        :key="entry.permission"
        class="permission-row permission-row--child"
        :class="{ 'text-disabled': isUnavailable(entry.instanceOnly) }"
      >
        <v-checkbox-btn
          :model-value="selected.includes(entry.permission)"
          :disabled="disabled || isUnavailable(entry.instanceOnly)"
          :aria-label="entry.label"
          density="compact"
          @update:model-value="toggle(entry.permission)"
        />
        <span class="permission-label text-body-medium">
          {{ entry.label }}
          <span v-if="isUnavailable(entry.instanceOnly)" class="text-body-small">(all events only)</span>
        </span>
        <code class="permission-name">{{ entry.permission }}</code>
      </div>
      <v-divider class="my-1" />
    </section>
  </div>
</template>

<style scoped>
/* Flexbox instead of CSS grid: Vuetify's selection controls carry their own grid-area. */
.permission-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
}
.permission-row :deep(.v-selection-control) {
  flex: 0 0 28px;
  min-height: 28px;
}
.permission-row :deep(.v-selection-control__wrapper),
.permission-row :deep(.v-selection-control__input) {
  width: 28px;
  height: 28px;
}
.permission-row--child {
  padding-left: 22px;
}
.permission-label {
  flex: 1 1 auto;
  min-width: 0;
}
.permission-name {
  flex: 0 0 14rem;
  font-size: 0.8rem;
  opacity: var(--v-medium-emphasis-opacity);
  overflow-wrap: anywhere;
  background: none;
}
@media (max-width: 600px) {
  .permission-name {
    display: none;
  }
}
</style>
