<script setup lang="ts">
import { mdiAlertCircle, mdiMagnify } from "@mdi/js";
import { computed, nextTick, provide, ref, useTemplateRef, watch } from "vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import { SETTINGS_HEADER_ACTIONS } from "./header-actions";
import { groupResults, searchSettings, type SettingsSearchEntry, type SettingsSection } from "./settings-search";

/**
 * A settings view: a menu of sections on the left, the selected section with its title and the
 * view-wide search on the right. Searching covers every section, also advanced settings; picking a
 * result opens its section and moves to the setting. Sections stay mounted while results show, so
 * unsaved input is never lost.
 */
const props = defineProps<{
  sections: SettingsSection[];
  searchIndex: SettingsSearchEntry[];
  /** Name of the menu for screen readers, e.g. "TAK settings". */
  label: string;
  /** Set when the settings could not be loaded, so the search says so instead of "no matches". */
  searchUnavailable?: boolean;
}>();
const selected = defineModel<string>({ required: true });
/** Lets the view reveal a hidden setting, e.g. switch on advanced settings, before it is focused. */
const emit = defineEmits<{ reveal: [entry: SettingsSearchEntry] }>();

const query = ref("");
const content = useTemplateRef<HTMLElement>("content");
/** Sections put their own actions, such as a module switch, into the header next to the title. */
const actions = useTemplateRef<HTMLElement>("actions");
provide(SETTINGS_HEADER_ACTIONS, actions);
const current = computed(() => props.sections.find(({ id }) => id === selected.value) ?? props.sections[0]);
const searching = computed(() => query.value.trim() !== "");
const results = computed(() => searchSettings(props.searchIndex, query.value));
const grouped = computed(() => groupResults(results.value, props.sections));

/** Sections in menu order with a heading wherever the group changes. */
const menu = computed(() =>
  props.sections.map((section, index) => ({ section, heading: index === 0 || props.sections[index - 1]?.group !== section.group })),
);

function scrollToTop(): void {
  const top = content.value?.getBoundingClientRect().top;
  if (top !== undefined && (top < 0 || top > window.innerHeight / 2)) {
    content.value?.scrollIntoView({ block: "start" });
  }
}

watch(selected, async () => {
  await nextTick();
  scrollToTop();
});

async function open(entry: SettingsSearchEntry): Promise<void> {
  emit("reveal", entry);
  selected.value = entry.sectionId;
  query.value = "";
  // The section and any revealed settings render over the next frames.
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const target = content.value?.querySelector<HTMLElement>(`[data-setting-id="${CSS.escape(entry.id)}"]`);
  if (target === null || target === undefined) {
    scrollToTop();
    return;
  }
  target.scrollIntoView({ block: "center" });
  target.querySelector<HTMLElement>("input, textarea, button, [tabindex]")?.focus({ preventScroll: true });
  target.classList.add("setting-found");
  window.setTimeout(() => target.classList.remove("setting-found"), 2000);
}
</script>

<template>
  <div class="settings-layout">
    <v-card class="settings-menu pa-2" tag="nav" :aria-label="label">
      <v-list density="comfortable" nav mandatory :selected="[selected]" @update:selected="selected = String($event[0] ?? selected)">
        <template v-for="{ section, heading } in menu" :key="section.id">
          <v-list-subheader v-if="heading">{{ section.group }}</v-list-subheader>
          <v-list-item :value="section.id" :prepend-icon="section.icon" :title="section.title">
            <template v-if="section.problem || section.badge" #append>
              <v-icon v-if="section.problem" :icon="mdiAlertCircle" color="error" size="18" aria-label="Has invalid settings" />
              <span v-else class="text-body-small text-medium-emphasis">{{ section.badge }}</span>
            </template>
          </v-list-item>
        </template>
      </v-list>
    </v-card>

    <div ref="content" class="settings-content">
      <div class="settings-header d-flex align-start ga-4 mb-4 flex-wrap flex-md-nowrap">
        <div v-if="current && !searching" class="d-flex align-center ga-4 flex-grow-1" style="min-width: 0">
          <v-avatar color="primary" variant="tonal" size="44">
            <v-icon :icon="current.icon" size="22" />
          </v-avatar>
          <div style="min-width: 0">
            <h2 class="text-title-large font-weight-medium settings-title">{{ current.title }}</h2>
            <p v-if="current.description" class="text-body-medium text-medium-emphasis my-0">{{ current.description }}</p>
          </div>
        </div>
        <div v-else class="d-flex align-center ga-4 flex-grow-1">
          <v-avatar color="primary" variant="tonal" size="44"><v-icon :icon="mdiMagnify" size="22" /></v-avatar>
          <div>
            <h2 class="text-title-large font-weight-medium settings-title">Search results</h2>
            <p class="text-body-medium text-medium-emphasis my-0" aria-live="polite">
              {{ searchUnavailable ? "Settings could not be loaded." : `${String(results.length)} ${results.length === 1 ? "setting" : "settings"} found` }}
            </p>
          </div>
        </div>
        <div v-show="!searching" ref="actions" class="d-flex align-center ga-2 flex-shrink-0 align-self-center" />
        <v-text-field
          v-model="query"
          class="settings-search"
          :prepend-inner-icon="mdiMagnify"
          label="Search settings"
          density="comfortable"
          clearable
          hide-details
          @keydown.enter="results[0] && open(results[0])"
        />
      </div>

      <div v-if="searching">
        <EmptyState
          v-if="searchUnavailable"
          :icon="mdiMagnify"
          title="Search is not available"
          text="The settings could not be loaded. Reload the page to search them."
        />
        <EmptyState
          v-else-if="results.length === 0"
          :icon="mdiMagnify"
          title="No matching settings"
          :text="`Nothing matches “${query.trim()}”. Try a shorter word or the setting's key.`"
        />
        <v-card v-for="{ section, entries } in grouped" v-else :key="section.id" class="mb-4">
          <v-list lines="two" class="py-0">
            <v-list-subheader>{{ section.title }}</v-list-subheader>
            <v-list-item
              v-for="entry in entries"
              :key="entry.id"
              :title="entry.label"
              :subtitle="[entry.key, entry.description === entry.label ? undefined : entry.description].filter(Boolean).join(' · ')"
              :prepend-icon="section.icon"
              @click="open(entry)"
            >
              <template v-if="entry.advanced" #append>
                <v-chip size="small" variant="tonal" label>Advanced</v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </div>
      <div v-show="!searching">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
/* The menu is longer than most windows: it scrolls on its own so it stays beside the content. */
.settings-menu {
  position: sticky;
  top: calc(var(--v-layout-top, 0px) + 16px);
  max-height: calc(100vh - var(--v-layout-top, 0px) - 32px);
  overflow-y: auto;
}
/* Icons sit close to their text, as in the official Meshtastic apps. */
.settings-menu :deep(.v-list-item__spacer) {
  width: 16px;
}
.settings-content {
  scroll-margin-top: calc(var(--v-layout-top, 0px) + 16px);
}
.settings-title {
  line-height: 1.3;
  margin: 0 0 2px;
}
.settings-search {
  flex: 0 0 320px;
  max-width: 100%;
}
/* A setting reached from the search is marked briefly so the eye finds it. */
.settings-content :deep(.setting-found) {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
  border-radius: 8px;
  transition: outline-color 0.3s;
}
/* Tablets and phones: the menu sits above the content instead of beside it. */
@media (max-width: 959px) {
  .settings-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .settings-menu {
    position: static;
    max-height: none;
  }
  .settings-search {
    flex: 1 1 100%;
  }
}
</style>
