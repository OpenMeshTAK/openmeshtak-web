<script setup lang="ts">
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiMagnify,
  mdiTuneVariant,
  mdiUnfoldLessHorizontal,
  mdiUnfoldMoreHorizontal,
} from "@mdi/js";
import { computed, ref } from "vue";
import { formatAge } from "../history/track-timeline";
import { activeFilterCount, groupContacts, type ContactFilter, type ContactKind, type ContactRow, type ContactSort, type ContactStatus } from "./contact-list";

/**
 * The contact panel of Live and History: contacts grouped by event group (platoon), with search,
 * a filter menu (status, kind, sort) and show/hide per contact or per group. One line per contact
 * and a virtualized list keep 200–300 contacts readable and smooth; details and actions sit in
 * each row's menu.
 */
const props = withDefaults(
  defineProps<{
    rows: ContactRow[];
    /** Offer "devices / markers" (History records both). */
    kinds?: boolean;
    /** Offer "no position yet" (Live lists apps before their first position). */
    withoutPosition?: boolean;
    canDelete?: boolean;
    emptyText: string;
  }>(),
  { kinds: false, withoutPosition: false, canDelete: false },
);
const hidden = defineModel<Set<string>>("hidden", { required: true });
const filter = defineModel<ContactFilter>("filter", { required: true });
defineEmits<{ focus: [key: string]; delete: [key: string] }>();

const collapsed = ref(new Set<string>());

const statuses = computed<Array<{ value: ContactStatus; title: string }>>(() => [
  { value: "all", title: "All" },
  { value: "current", title: "Current" },
  { value: "stale", title: "Not heard from" },
  ...(props.withoutPosition ? [{ value: "none" as const, title: "No position" }] : []),
]);
const kindOptions: Array<{ value: ContactKind; title: string }> = [
  { value: "all", title: "All" },
  { value: "devices", title: "Devices" },
  { value: "markers", title: "Markers" },
];
const sorts: Array<{ value: ContactSort; title: string }> = [
  { value: "name", title: "Name" },
  { value: "recent", title: "Recently heard" },
  { value: "silent", title: "Longest silent" },
];

const groups = computed(() => groupContacts(props.rows, filter.value));
const matching = computed(() => groups.value.reduce((sum, group) => sum + group.rows.length, 0));
const hiddenCount = computed(() => props.rows.filter((row) => hidden.value.has(row.key)).length);
const filters = computed(() => activeFilterCount(filter.value));
const allCollapsed = computed(() => groups.value.length > 0 && groups.value.every((group) => collapsed.value.has(group.name)));

interface GroupItem {
  kind: "group";
  key: string;
  name: string;
  keys: string[];
  shown: number;
}

interface ContactItem {
  kind: "contact";
  key: string;
  row: ContactRow;
}

const items = computed<Array<GroupItem | ContactItem>>(() =>
  groups.value.flatMap((group) => {
    const keys = group.rows.map((row) => row.key);
    const header: GroupItem = { kind: "group", key: `group:${group.name}`, name: group.name, keys, shown: keys.filter((key) => !hidden.value.has(key)).length };
    if (collapsed.value.has(group.name)) return [header];
    return [header, ...group.rows.map((row): ContactItem => ({ kind: "contact", key: row.key, row }))];
  }),
);

function setFilter(patch: Partial<ContactFilter>): void {
  filter.value = { ...filter.value, ...patch };
}

function toggle(key: string): void {
  const next = new Set(hidden.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  hidden.value = next;
}

function toggleGroup(group: GroupItem): void {
  const next = new Set(hidden.value);
  const show = group.shown < group.keys.length;
  for (const key of group.keys) {
    if (show) next.delete(key);
    else next.add(key);
  }
  hidden.value = next;
}

function toggleCollapsed(name: string): void {
  const next = new Set(collapsed.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  collapsed.value = next;
}

function toggleAllCollapsed(): void {
  collapsed.value = allCollapsed.value ? new Set() : new Set(groups.value.map((group) => group.name));
}

function age(row: ContactRow): string {
  return row.ageMs === null ? "–" : formatAge(row.ageMs);
}
</script>

<template>
  <div class="contact-list">
    <div class="d-flex align-center ga-1 px-3 pt-3">
      <v-text-field
        :model-value="filter.search"
        :prepend-inner-icon="mdiMagnify"
        placeholder="Search callsign or name"
        aria-label="Search contacts"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        @update:model-value="setFilter({ search: $event ?? '' })"
      />
      <v-menu :close-on-content-click="false" location="bottom end">
        <template #activator="{ props: menu }">
          <v-btn v-bind="menu" variant="text" size="small" icon aria-label="Filter and sort contacts">
            <v-badge :model-value="filters > 0" :content="filters" color="primary">
              <v-icon :icon="mdiTuneVariant" />
            </v-badge>
          </v-btn>
        </template>
        <v-card min-width="260" class="pa-3">
          <div class="text-label-medium text-medium-emphasis mb-1">Status</div>
          <div class="d-flex flex-wrap ga-1 mb-3">
            <v-chip
              v-for="option in statuses"
              :key="option.value"
              size="small"
              :variant="filter.status === option.value ? 'tonal' : 'text'"
              :color="filter.status === option.value ? 'primary' : undefined"
              @click="setFilter({ status: option.value })"
            >
              {{ option.title }}
            </v-chip>
          </div>
          <template v-if="kinds">
            <div class="text-label-medium text-medium-emphasis mb-1">Show</div>
            <div class="d-flex flex-wrap ga-1 mb-3">
              <v-chip
                v-for="option in kindOptions"
                :key="option.value"
                size="small"
                :variant="filter.kind === option.value ? 'tonal' : 'text'"
                :color="filter.kind === option.value ? 'primary' : undefined"
                @click="setFilter({ kind: option.value })"
              >
                {{ option.title }}
              </v-chip>
            </div>
          </template>
          <div class="text-label-medium text-medium-emphasis mb-1">Sort</div>
          <div class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="option in sorts"
              :key="option.value"
              size="small"
              :variant="filter.sort === option.value ? 'tonal' : 'text'"
              :color="filter.sort === option.value ? 'primary' : undefined"
              @click="setFilter({ sort: option.value })"
            >
              {{ option.title }}
            </v-chip>
          </div>
        </v-card>
      </v-menu>
      <v-btn
        :icon="allCollapsed ? mdiUnfoldMoreHorizontal : mdiUnfoldLessHorizontal"
        variant="text"
        size="small"
        :aria-label="allCollapsed ? 'Expand all groups' : 'Collapse all groups'"
        :disabled="groups.length === 0"
        @click="toggleAllCollapsed"
      />
    </div>
    <div class="d-flex align-center px-4 pt-1 pb-1 text-body-small text-medium-emphasis">
      <span class="flex-grow-1">{{ matching }} of {{ rows.length }}<template v-if="hiddenCount > 0"> · {{ hiddenCount }} hidden on the map</template></span>
      <v-btn v-if="hiddenCount > 0" variant="text" size="x-small" @click="hidden = new Set()">Show all</v-btn>
    </div>

    <p v-if="rows.length === 0" class="text-body-medium text-medium-emphasis px-4 pb-3 my-0">{{ emptyText }}</p>
    <p v-else-if="items.length === 0" class="text-body-medium text-medium-emphasis px-4 pb-3 my-0">Nothing matches the search and filter.</p>
    <v-virtual-scroll v-else :items="items" item-key="key" :item-height="36" class="contact-scroll">
      <template #default="{ item }">
        <div v-if="item.kind === 'group'" class="contact-row group-row">
          <v-btn
            :icon="collapsed.has(item.name) ? mdiChevronRight : mdiChevronDown"
            variant="text"
            size="x-small"
            :aria-label="collapsed.has(item.name) ? `Expand ${item.name}` : `Collapse ${item.name}`"
            @click="toggleCollapsed(item.name)"
          />
          <v-checkbox-btn
            :model-value="item.shown === item.keys.length"
            :indeterminate="item.shown > 0 && item.shown < item.keys.length"
            density="compact"
            class="flex-0-0"
            :aria-label="`Show ${item.name} on the map`"
            @update:model-value="toggleGroup(item)"
          />
          <span class="text-label-large text-truncate text-start flex-grow-1 group-name" role="button" tabindex="0" @click="toggleCollapsed(item.name)" @keydown.enter="toggleCollapsed(item.name)">
            {{ item.name }}
          </span>
          <span class="text-body-small text-medium-emphasis pe-2">{{ item.shown }}/{{ item.keys.length }}</span>
        </div>
        <div
          v-else
          class="contact-row"
          :class="{ 'contact-row--muted': item.row.ageMs === null || hidden.has(item.key) }"
          role="button"
          tabindex="0"
          @click="item.row.ageMs !== null && $emit('focus', item.key)"
          @keydown.enter="item.row.ageMs !== null && $emit('focus', item.key)"
        >
          <v-checkbox-btn
            :model-value="!hidden.has(item.key)"
            :color="item.row.color ?? 'primary'"
            density="compact"
            class="flex-0-0 ms-6"
            :aria-label="`Show ${item.row.label} on the map`"
            @click.stop
            @update:model-value="toggle(item.key)"
          />
          <span v-if="item.row.color !== null" class="contact-swatch" :style="{ background: item.row.color }" />
          <span class="text-body-medium text-truncate flex-grow-1" :title="item.row.label">{{ item.row.label }}</span>
          <span class="text-body-small text-no-wrap" :class="item.row.stale ? 'text-warning' : 'text-medium-emphasis'">{{ age(item.row) }}</span>
          <v-menu location="start">
            <template #activator="{ props: menu }">
              <v-btn v-bind="menu" :icon="mdiDotsVertical" variant="text" size="x-small" :aria-label="`More about ${item.row.label}`" @click.stop />
            </template>
            <v-list density="compact" min-width="240">
              <v-list-item :title="item.row.label">
                <v-list-item-subtitle v-for="line in item.row.details" :key="line">{{ line }}</v-list-item-subtitle>
                <v-list-item-subtitle>{{ item.row.ageMs === null ? "No position yet" : `Last position ${age(item.row)} old` }}</v-list-item-subtitle>
              </v-list-item>
              <template v-if="canDelete">
                <v-divider />
                <v-list-item :prepend-icon="mdiDeleteOutline" title="Delete recorded positions" base-color="error" @click="$emit('delete', item.key)" />
              </template>
            </v-list>
          </v-menu>
        </div>
      </template>
    </v-virtual-scroll>
  </div>
</template>

<style scoped>
.contact-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.contact-scroll {
  flex: 1;
  min-height: 0;
  padding-bottom: 4px;
}

.contact-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 4px 0 8px;
  cursor: pointer;
}

.contact-row:hover,
.contact-row:focus-visible {
  background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}

.contact-row--muted {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.group-row {
  cursor: default;
}

.group-name {
  min-width: 0;
  cursor: pointer;
}

.contact-swatch {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
