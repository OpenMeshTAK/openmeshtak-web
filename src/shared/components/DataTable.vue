<script setup lang="ts" generic="T extends object">
import { mdiMagnify } from "@mdi/js";
import { computed, ref, watch } from "vue";

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
  },
);

/** Click a column title to sort; a second click reverses, a third clears the sort. */
const sortBy = defineModel<DataTableSort>("sortBy", { default: () => [] });

defineOptions({ inheritAttrs: false });
// Typed so that `item.<key>` slots in the views see the row type instead of `any`.
const slots = defineSlots<
  { toolbar?: () => unknown } & Record<`item.${string}`, ((scope: { item: T; index: number }) => unknown) | undefined>
>();
const cellSlots = computed(() => Object.keys(slots).filter((name) => name !== "toolbar") as `item.${string}`[]);

const smallestPage = computed(() => Math.min(...props.pageSizes));
/** Short lists need neither a search field nor pages. */
const long = computed(() => props.items.length > smallestPage.value);
const showSearch = computed(() => (props.searchable === "auto" ? long.value : props.searchable));
const paged = computed(() => props.itemsPerPage !== -1 && long.value);

const search = ref<string | null>("");
const page = ref(1);
const perPage = ref(props.itemsPerPage);

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

watch(search, () => {
  page.value = 1;
});
</script>

<template>
  <div>
    <div v-if="showSearch || slots.toolbar" class="d-flex align-center flex-wrap ga-3 px-4 pt-3 pb-2">
      <v-text-field
        v-if="showSearch"
        v-model="search"
        :prepend-inner-icon="mdiMagnify"
        :label="props.searchLabel"
        density="compact"
        clearable
        hide-details
        class="data-table__search"
      />
      <slot name="toolbar" />
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
    >
      <template v-for="name in cellSlots" #[name]="scope" :key="name">
        <slot :name="name" v-bind="scope" />
      </template>
    </v-data-table>
  </div>
</template>

<style scoped>
.data-table__search {
  flex: 1 1 280px;
  max-width: 420px;
}
</style>
