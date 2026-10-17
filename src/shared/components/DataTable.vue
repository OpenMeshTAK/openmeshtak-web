<script setup lang="ts" generic="T extends object">
import { mdiMagnify } from "@mdi/js";
import { computed, ref, watch } from "vue";
import { loadTablePreferences, saveTablePreferences } from "./data-table-preferences";

/**
 * The app's list table: search, pages and sortable columns for lists that can grow to hundreds of
 * rows, such as accounts, members or certificates. Every list it shows is loaded whole, so it
 * searches, sorts and pages in the browser. Further `v-data-table` props and events, e.g.
 * `custom-key-sort`, `hover` or `@click:row`, pass through, and so do `item.<key>` cell slots.
 */
export interface DataTableHeader<Row> {
  title: string;
  key: string;
  /** What the column shows, sorts and searches by; by default the row's property named `key`. */
  value?: (item: Row) => unknown;
  /** Columns sort by clicking their title unless this is false, e.g. for actions. */
  sortable?: boolean;
  /** Leaves the column out of the default search, e.g. for dates. */
  searchable?: boolean;
  align?: "start" | "center" | "end";
  width?: string | number;
  nowrap?: boolean;
}

export type DataTableSort = { key: string; order: "asc" | "desc" }[];

const props = withDefaults(
  defineProps<{
    headers: DataTableHeader<T>[];
    items: T[];
    itemValue?: string;
    /** "auto" shows the search field only when the list is longer than the smallest page. */
    searchable?: boolean | "auto";
    searchLabel?: string;
    /** The texts a row is found by; by default the values of its searchable columns. */
    searchText?: ((item: T) => unknown[]) | null;
    /** Rows per page at first; -1 shows all rows without pages. */
    itemsPerPage?: number;
    pageSizes?: number[];
    density?: "default" | "comfortable" | "compact";
    noDataText?: string;
    /** Remembers page size and sort order in this browser under this name, e.g. "users". */
    storageKey?: string | null;
  }>(),
  {
    itemValue: "id",
    searchable: "auto",
    searchLabel: "Search",
    searchText: null,
    itemsPerPage: 25,
    pageSizes: () => [10, 25, 50, 100],
    density: "comfortable",
    noDataText: "Nothing matches the search.",
    storageKey: null,
  },
);

/** Click a column title to sort; a second click reverses, a third clears the sort. */
const sortBy = defineModel<DataTableSort>("sortBy", { default: () => [] });

defineOptions({ inheritAttrs: false });
// Typed so that `item.<key>` slots in the views see the row type instead of `any`.
const slots = defineSlots<
  { toolbar?: () => unknown; actions?: () => unknown } & Record<`item.${string}`, ((scope: { item: T; index: number }) => unknown) | undefined>
>();
const cellSlots = computed(() => Object.keys(slots).filter((name) => name !== "toolbar" && name !== "actions") as `item.${string}`[]);

const smallestPage = computed(() => Math.min(...props.pageSizes));
/** Short lists need neither a search field nor pages. */
const long = computed(() => props.items.length > smallestPage.value);
const showSearch = computed(() => (props.searchable === "auto" ? long.value : props.searchable));
const paged = computed(() => props.itemsPerPage !== -1 && long.value);

const search = ref<string | null>("");
const page = ref(1);
const perPage = ref(props.itemsPerPage);

if (props.storageKey !== null) {
  const stored = loadTablePreferences(props.storageKey);
  const columns = new Set(props.headers.filter((header) => header.sortable !== false).map((header) => header.key));
  if (stored.itemsPerPage !== undefined && props.pageSizes.includes(stored.itemsPerPage)) {
    perPage.value = stored.itemsPerPage;
  }
  // A column that a later version renamed or removed is dropped from the stored sort.
  if (stored.sortBy !== undefined) {
    sortBy.value = stored.sortBy.filter(({ key }) => columns.has(key));
  }
  watch([perPage, sortBy], () => {
    saveTablePreferences(props.storageKey as string, { itemsPerPage: perPage.value, sortBy: sortBy.value });
  });
}

function columnTexts(item: T): unknown[] {
  return props.headers
    .filter((header) => header.searchable !== false && header.key !== "actions")
    .map((header) => (header.value ? header.value(item) : (item as Record<string, unknown>)[header.key]));
}

const shown = computed(() => {
  const query = (search.value ?? "").trim().toLowerCase();
  if (query === "") {
    return props.items;
  }
  return props.items.filter((item) =>
    (props.searchText ? props.searchText(item) : columnTexts(item)).some(
      (text) => (typeof text === "string" || typeof text === "number") && String(text).toLowerCase().includes(query),
    ),
  );
});

const searching = computed(() => (search.value ?? "").trim() !== "");

watch(search, () => {
  page.value = 1;
});
</script>

<template>
  <div>
    <div v-if="showSearch || slots.toolbar || slots.actions" class="data-table__toolbar">
      <slot name="toolbar" />
      <span v-if="searching" class="data-table__count text-body-small text-medium-emphasis">
        {{ shown.length }} of {{ props.items.length }}
      </span>
      <v-text-field
        v-if="showSearch"
        v-model="search"
        :prepend-inner-icon="mdiMagnify"
        :placeholder="props.searchLabel"
        :aria-label="props.searchLabel"
        variant="solo-filled"
        flat
        rounded="lg"
        density="compact"
        clearable
        hide-details
        class="data-table__search"
      />
      <div v-if="slots.actions" class="data-table__actions"><slot name="actions" /></div>
    </div>
    <v-data-table
      v-model:page="page"
      v-model:items-per-page="perPage"
      v-model:sort-by="sortBy"
      v-bind="$attrs"
      :headers="props.headers"
      :items="shown"
      :item-value="props.itemValue"
      :items-per-page-options="props.pageSizes"
      :hide-default-footer="!paged"
      :density="props.density"
      :no-data-text="props.noDataText"
      mobile-breakpoint="sm"
      class="data-table"
    >
      <template v-for="name in cellSlots" #[name]="scope" :key="name">
        <slot :name="name" v-bind="scope" />
      </template>
    </v-data-table>
  </div>
</template>

<style scoped>
.data-table__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.data-table__search {
  flex: 0 1 320px;
  min-width: 200px;
}

/* Filters from the toolbar slot stay left; the count and the search field sit on the right. */
.data-table__count,
.data-table__search {
  margin-left: auto;
}

.data-table__count {
  white-space: nowrap;
}

.data-table__actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.data-table__count + .data-table__search,
.data-table__search + .data-table__actions {
  margin-left: 0;
}

/* Quiet column titles, so the rows carry the visual weight. */
.data-table :deep(thead th) {
  height: 40px !important;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.data-table :deep(.v-data-table__th--sorted) {
  color: rgb(var(--v-theme-on-surface));
}
</style>
