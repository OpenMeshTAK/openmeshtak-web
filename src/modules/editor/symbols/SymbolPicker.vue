<script setup lang="ts">
import { mdiCircle, mdiMagnify } from "@mdi/js";
import { computed, ref, watch } from "vue";
import { symbolPreview } from "../map/cot-symbol";
import { AFFILIATIONS, cotTypeOf, SYMBOLS, type CatalogSymbol } from "./symbol-catalog";

/**
 * Emoji-picker style choice of a marker symbol: pick the affiliation, then click a symbol.
 * `null` selects the plain coloured spot marker.
 */
const props = defineProps<{ cotType: string | null }>();
const emit = defineEmits<{ select: [cotType: string | null] }>();

/** The tab being browsed: an affiliation code or "spot". Independent of the current selection. */
const tab = ref("f");
const search = ref("");
const affiliation = computed(() => (tab.value === "spot" ? "f" : tab.value));

/** Each tab shows the real frame of its affiliation, e.g. a diamond for hostile. */
const tabs = computed(() =>
  AFFILIATIONS.map((option) => ({ ...option, frame: symbolPreview(`a-${option.code}-G`, 18) })),
);

watch(
  () => props.cotType,
  (cotType) => {
    const current = cotType?.split("-")[1];
    // Open on the affiliation of the current symbol; spot markers open on Friendly to browse.
    tab.value = cotType?.startsWith("a-") && AFFILIATIONS.some(({ code }) => code === current) ? (current ?? "f") : "f";
  },
  { immediate: true },
);

interface Tile extends CatalogSymbol {
  cotType: string;
  preview: string;
}

/** Catalogue entries the symbol library can draw, filtered by the search words. */
const groups = computed(() => {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const tiles: Tile[] = SYMBOLS.flatMap((symbol) => {
    const cotType = cotTypeOf(affiliation.value, symbol);
    const preview = symbolPreview(cotType, 32);
    const haystack = `${symbol.label} ${symbol.group} ${symbol.keywords ?? ""}`.toLowerCase();
    return preview !== null && words.every((word) => haystack.includes(word)) ? [{ ...symbol, cotType, preview }] : [];
  });
  return [...new Set(tiles.map(({ group }) => group))].map((group) => ({
    group,
    tiles: tiles.filter((tile) => tile.group === group),
  }));
});
</script>

<template>
  <v-card width="440" max-height="520" class="d-flex flex-column">
    <v-tabs v-model="tab" density="compact" grow class="flex-shrink-0 picker-tabs">
      <v-tab value="spot" class="text-none px-2">
        <v-icon :icon="mdiCircle" size="14" class="mr-1" />
        Spot
      </v-tab>
      <v-tab v-for="option in tabs" :key="option.code" :value="option.code" class="text-none px-2">
        <img v-if="option.frame" :src="option.frame" alt="" class="tab-frame mr-1">
        {{ option.label }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <div v-if="tab === 'spot'" class="pa-4">
      <button type="button" class="symbol-tile spot-tile" :class="{ 'symbol-tile--active': cotType === null }" @click="emit('select', null)">
        <v-icon :icon="mdiCircle" size="28" />
        <span>Coloured dot</span>
      </button>
      <p class="text-caption text-medium-emphasis mt-3 mb-0">
        The ATAK spot marker. Its colour is set under Style.
      </p>
    </div>

    <template v-else>
      <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          placeholder="Search, e.g. medic or drone"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          clearable
        />
      </div>

      <div class="flex-grow-1 overflow-y-auto px-3 pb-3">
        <p v-if="groups.length === 0" class="text-body-2 text-medium-emphasis">No symbol matches.</p>
        <div v-for="section in groups" :key="section.group" class="mb-3">
          <div class="text-caption text-medium-emphasis mb-1">{{ section.group }}</div>
          <div class="symbol-grid">
            <button
              v-for="tile in section.tiles"
              :key="tile.cotType"
              type="button"
              class="symbol-tile"
              :class="{ 'symbol-tile--active': tile.cotType === cotType }"
              :title="tile.cotType"
              @click="emit('select', tile.cotType)"
            >
              <img :src="tile.preview" alt="">
              <span>{{ tile.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </v-card>
</template>

<style scoped>
/* Five tabs must fit the card; Vuetify's default tab minimum width is too wide for that. */
.picker-tabs :deep(.v-tab) {
  min-width: 0;
  font-size: 0.8125rem;
  letter-spacing: normal;
}
.tab-frame {
  height: 14px;
  width: auto;
}
.spot-tile {
  width: 104px;
}
.symbol-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.symbol-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
}
.symbol-tile img {
  height: 32px;
  width: auto;
}
.symbol-tile:hover,
.symbol-tile:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.08);
  outline: none;
}
.symbol-tile--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
</style>
