<script setup lang="ts">
import { mdiCircle, mdiMagnify, mdiSquareRounded, mdiTriangle } from "@mdi/js";
import { computed, ref, watch } from "vue";
import { useSession } from "@/modules/auth/session";
import { symbolPreview } from "../map/cot-symbol";
import type { IconChoice } from "../useIconSets";
import { AFFILIATIONS, cotTypeOf, POINT_MARKERS, SYMBOLS, type CatalogSymbol } from "./symbol-catalog";

/**
 * Emoji-picker style choice of a marker symbol: plain points (spot marker, waypoint, checkpoint),
 * a military symbol after choosing its affiliation, or an image from a loaded icon set.
 * `null` selects the coloured spot marker.
 */
const props = withDefaults(defineProps<{ cotType: string | null; icons?: IconChoice[]; iconsetPath?: string | null }>(), {
  icons: () => [],
  iconsetPath: null,
});
const emit = defineEmits<{ select: [cotType: string | null]; selectIcon: [icon: IconChoice] }>();
const session = useSession();

/** Shapes the map draws for plain points; the same shapes appear here. */
const POINT_ICONS: Record<string, string> = { "b-m-p-w": mdiTriangle, "b-m-p-c": mdiSquareRounded };
/** Icon sets can hold thousands of images; the grid grows on demand instead of rendering all. */
const ICON_PAGE = 96;

const tab = ref<"points" | "military" | "icons">("military");
const affiliation = ref("f");
const search = ref("");
const iconSearch = ref("");
const iconLimit = ref(ICON_PAGE);

/** Each choice shows the real frame of its affiliation, e.g. a diamond for hostile. */
const affiliations = computed(() =>
  AFFILIATIONS.map((option) => ({ ...option, frame: symbolPreview(`a-${option.code}-G`, 16) })),
);

watch(
  () => [props.cotType, props.iconsetPath, props.icons.length > 0] as const,
  ([cotType, iconsetPath, hasIcons]) => {
    const current = cotType?.split("-")[1];
    const military = cotType?.startsWith("a-") === true && AFFILIATIONS.some(({ code }) => code === current);
    // Open where the current symbol is; plain points open on their tab.
    if (iconsetPath !== null && hasIcons) {
      tab.value = "icons";
    } else {
      tab.value = military || (cotType !== null && !POINT_MARKERS.some((marker) => marker.cotType === cotType)) ? "military" : "points";
    }
    affiliation.value = military ? (current ?? "f") : "f";
  },
  { immediate: true },
);
watch(iconSearch, () => {
  iconLimit.value = ICON_PAGE;
});

interface Tile extends CatalogSymbol {
  cotType: string;
  preview: string;
}

function wordsOf(text: string | null): string[] {
  return (text ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Catalogue entries the symbol library can draw, filtered by the search words. */
const groups = computed(() => {
  const words = wordsOf(search.value);
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

const matchingIcons = computed(() => {
  const words = wordsOf(iconSearch.value);
  return props.icons.filter((icon) => {
    const haystack = `${icon.setName} ${icon.group} ${icon.filename}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
});

/** Icons grouped by set and group, the way ATAK lists them. */
const iconGroups = computed(() => {
  const sections = new Map<string, IconChoice[]>();
  for (const icon of matchingIcons.value.slice(0, iconLimit.value)) {
    const key = icon.group === "" || icon.group === icon.setName ? icon.setName : `${icon.setName} · ${icon.group}`;
    sections.set(key, [...(sections.get(key) ?? []), icon]);
  }
  return [...sections].map(([group, icons]) => ({ group, icons }));
});

function iconLabel(icon: IconChoice): string {
  return icon.filename.replace(/\.[a-z0-9]+$/i, "");
}
</script>

<template>
  <v-card width="440" max-height="560" class="d-flex flex-column">
    <v-tabs v-model="tab" density="compact" grow class="flex-shrink-0">
      <v-tab value="points" class="text-none">Points</v-tab>
      <v-tab value="military" class="text-none">Military symbols</v-tab>
      <v-tab v-if="icons.length > 0" value="icons" class="text-none">Icon sets</v-tab>
    </v-tabs>
    <v-divider />

    <div v-if="tab === 'points'" class="pa-4 d-flex ga-2">
      <button
        v-for="marker in POINT_MARKERS"
        :key="marker.label"
        type="button"
        class="symbol-tile point-tile"
        :class="{ 'symbol-tile--active': cotType === marker.cotType && iconsetPath === null }"
        :title="marker.cotType ?? 'b-m-p-s-m'"
        @click="emit('select', marker.cotType)"
      >
        <v-icon :icon="marker.cotType === null ? mdiCircle : POINT_ICONS[marker.cotType]" size="28" />
        <span>{{ marker.label }}</span>
      </button>
    </div>

    <template v-else-if="tab === 'icons'">
      <div class="px-3 pt-3 flex-shrink-0">
        <v-text-field
          v-model="iconSearch"
          :prepend-inner-icon="mdiMagnify"
          placeholder="Search set, group or file name"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          clearable
          class="mb-2"
        />
      </div>
      <div class="flex-grow-1 overflow-y-auto px-3 pb-3">
        <p v-if="iconGroups.length === 0" class="text-body-medium text-medium-emphasis ma-0">No icon matches.</p>
        <div v-for="section in iconGroups" :key="section.group" class="mb-3">
          <div class="text-body-small text-medium-emphasis mb-1 text-truncate">{{ section.group }}</div>
          <div class="symbol-grid">
            <button
              v-for="icon in section.icons"
              :key="icon.id"
              type="button"
              class="symbol-tile"
              :class="{ 'symbol-tile--active': icon.path === iconsetPath }"
              :title="icon.path"
              @click="emit('selectIcon', icon)"
            >
              <img :src="icon.imageUrl" alt="" loading="lazy">
              <span class="icon-name">{{ iconLabel(icon) }}</span>
            </button>
          </div>
        </div>
        <v-btn v-if="matchingIcons.length > iconLimit" variant="text" block class="text-none" @click="iconLimit += ICON_PAGE">
          Show more ({{ matchingIcons.length - iconLimit }})
        </v-btn>
      </div>
      <v-divider />
      <div class="d-flex align-center ga-2 px-3 py-1 flex-shrink-0 text-body-small text-medium-emphasis">
        <span class="flex-grow-1">TAK shows the icon when the same icon set is installed there.</span>
        <v-btn v-if="session.can('settings.manage')" variant="text" size="small" class="text-none" :to="{ name: 'general-settings' }">
          Manage
        </v-btn>
      </div>
    </template>

    <template v-else>
      <div class="px-3 pt-3 flex-shrink-0">
        <v-chip-group v-model="affiliation" mandatory column selected-class="text-primary" aria-label="Affiliation">
          <v-chip v-for="option in affiliations" :key="option.code" :value="option.code" size="small" variant="text">
            <img v-if="option.frame" :src="option.frame" alt="" class="affiliation-frame mr-1">
            {{ option.label }}
          </v-chip>
        </v-chip-group>
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          placeholder="Search, e.g. medic or drone"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          clearable
          class="mt-1 mb-2"
        />
      </div>

      <div class="flex-grow-1 overflow-y-auto px-3 pb-3">
        <p v-if="groups.length === 0" class="text-body-medium text-medium-emphasis ma-0">No symbol matches.</p>
        <div v-for="section in groups" :key="section.group" class="mb-3">
          <div class="text-body-small text-medium-emphasis mb-1">{{ section.group }}</div>
          <div class="symbol-grid">
            <button
              v-for="tile in section.tiles"
              :key="tile.cotType"
              type="button"
              class="symbol-tile"
              :class="{ 'symbol-tile--active': tile.cotType === cotType && iconsetPath === null }"
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
.affiliation-frame {
  height: 14px;
  width: auto;
}
.point-tile {
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
  min-width: 0;
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
  max-width: 100%;
  object-fit: contain;
}
.icon-name {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
