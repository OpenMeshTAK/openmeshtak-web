<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import SettingsLayout from "@/shared/settings/SettingsLayout.vue";
import type { SettingsSearchEntry } from "@/shared/settings/settings-search";
import { listGroups, type EventGroupDto } from "@/modules/event-groups/event-groups.api";
import { listRoles, type EventRoleDto } from "@/modules/event-roles/event-roles.api";
import { listMembers, type EventMemberDto } from "@/modules/members/members.api";
import PresetsSection from "@/modules/settings-presets/PresetsSection.vue";
import AtakRestrictionsSection from "./AtakRestrictionsSection.vue";
import AtakTargetedSection from "./AtakTargetedSection.vue";
import AtakTopicSection from "./AtakTopicSection.vue";
import TakGroupsSettings from "./TakGroupsSettings.vue";
import {
  getAtakPreferenceCatalog,
  getAtakPreferences,
  importAtakPreferences,
  replaceAtakPreferences,
  type AtakPreferenceCatalogDto,
  type AtakPreferenceEntryDto,
  type AtakPreferenceListDto,
  type ImportAtakPreferencesResponse,
} from "./tak-configuration.api";
import {
  APP_PREFERENCES,
  eventTopics,
  restrictedItemOf,
  takSearchIndex,
  takSections,
  targetKey,
  topicSectionId,
  type TargetOption,
} from "./tak-settings";

/**
 * The event's TAK setup: TAK groups, then the ATAK settings members' apps receive, one menu entry
 * per catalog topic for the whole event. Settings for single groups, roles or members are kept
 * under "Targeted & custom". All ATAK settings are saved as one list; members get them once the
 * configuration is published.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

const catalog = ref<AtakPreferenceCatalogDto | null>(null);
const list = ref<AtakPreferenceListDto | null>(null);
const entries = ref<AtakPreferenceEntryDto[]>([]);
const groups = ref<EventGroupDto[]>([]);
const roles = ref<EventRoleDto[]>([]);
const members = ref<EventMemberDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const selected = ref("groups");
const showAdvanced = ref(false);
const saving = ref(false);
const importing = ref(false);
const importResult = ref<ImportAtakPreferencesResponse | null>(null);
const errors = ref<Record<string, string>>({});

/** Every target with the number of settings it holds, so set targets are easy to find. */
const targetItems = computed<TargetOption[]>(() => {
  const counts = new Map<string, number>();
  for (const entry of entries.value) {
    counts.set(targetKey(entry.target), (counts.get(targetKey(entry.target)) ?? 0) + 1);
  }
  const count = (value: string) => counts.get(value) ?? 0;
  return [
    { value: "event", kind: "Event" as const, name: "Whole event", count: count("event") },
    ...groups.value.map((group) => ({ value: `group:${group.id}`, kind: "Group" as const, name: group.name, count: count(`group:${group.id}`) })),
    ...roles.value.map((role) => ({ value: `role:${role.id}`, kind: "Role" as const, name: role.name, count: count(`role:${role.id}`) })),
    ...members.value.map((member) => ({
      value: `member:${member.id}`,
      kind: "Member" as const,
      name: member.callsign,
      detail: member.eventGroup.name,
      count: count(`member:${member.id}`),
    })),
  ];
});
const targetTitles = computed(
  () => new Map(targetItems.value.map(({ value, kind, name }) => [value, kind === "Event" ? name : `${kind} ${name}`])),
);

const dirty = computed(() => list.value !== null && JSON.stringify(list.value.entries) !== JSON.stringify(entries.value));

/** Menu sections with invalid entries: locks, the topic of a known key, otherwise "Targeted & custom". */
const problemSections = computed(() => {
  const topicOf = new Map((catalog.value?.topics ?? []).flatMap((topic) => topic.keys.map(({ key }) => [key, topicSectionId(topic.id)] as const)));
  const sections = new Set<string>();
  for (const field of Object.keys(errors.value)) {
    const entry = entries.value[Number(/^entries\[(\d+)\]/.exec(field)?.[1] ?? -1)];
    if (entry !== undefined && restrictedItemOf(entry) !== null) {
      sections.add("restrictions");
    } else {
      sections.add(entry !== undefined && entry.preference === APP_PREFERENCES ? (topicOf.get(entry.key) ?? "targeted") : "targeted");
    }
  }
  return sections;
});
const sections = computed(() => takSections(catalog.value, problemSections.value));
const searchIndex = computed(() => takSearchIndex(catalog.value));
const currentTopic = computed(() => eventTopics(catalog.value).find((topic) => topicSectionId(topic.id) === selected.value) ?? null);

/** Problems of entries for other targets would stay hidden on a topic page, so list them all. */
const problemList = computed(() =>
  Object.entries(errors.value).map(([field, message]) => {
    const entry = entries.value[Number(/^entries\[(\d+)\]/.exec(field)?.[1] ?? -1)];
    return entry === undefined
      ? message
      : `${targetTitles.value.get(targetKey(entry.target)) ?? "Unknown target"} · ${entry.key}: ${message}`;
  }),
);

function show(loaded: AtakPreferenceListDto): void {
  list.value = loaded;
  entries.value = loaded.entries.map((entry) => ({ ...entry, target: { ...entry.target } }));
  errors.value = {};
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedCatalog, loadedList, loadedGroups, loadedRoles, loadedMembers] = await Promise.all([
      getAtakPreferenceCatalog(),
      getAtakPreferences(props.eventId),
      listGroups(props.eventId),
      listRoles(props.eventId),
      listMembers(props.eventId),
    ]);
    catalog.value = loadedCatalog;
    groups.value = loadedGroups;
    roles.value = loadedRoles;
    members.value = loadedMembers;
    show(loadedList);
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

async function save(): Promise<void> {
  if (list.value === null) {
    return;
  }
  saving.value = true;
  errors.value = {};
  try {
    show(await replaceAtakPreferences(props.eventId, { version: list.value.version, entries: entries.value }));
    toast.success("ATAK settings saved. Publish the configuration so members get them.");
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

async function importFile(file: File): Promise<void> {
  if (list.value === null) {
    return;
  }
  importing.value = true;
  errors.value = {};
  try {
    const result = await importAtakPreferences(props.eventId, { version: list.value.version, fileName: file.name, content: await file.text() });
    show(result.list);
    importResult.value = result;
    toast.success(`Imported ${String(result.importedCount)} settings for the whole event. Publish the configuration so members get them.`);
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    toast.error(caught);
  } finally {
    importing.value = false;
  }
}

/** An imported preset changed the draft on the server; show it without losing the catalog. */
async function reloadList(): Promise<void> {
  try {
    show(await getAtakPreferences(props.eventId));
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

/** A search result for an advanced key turns advanced settings on; the target never changes. */
function reveal(entry: SettingsSearchEntry): void {
  if (entry.advanced === true) {
    showAdvanced.value = true;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <v-skeleton-loader v-if="state === 'loading'" type="list-item@6" />
    <ErrorState v-else-if="state === 'error' || catalog === null" :message="loadError" @retry="load" />

    <SettingsLayout
      v-else
      v-model="selected"
      :sections="sections"
      :search-index="searchIndex"
      label="TAK settings"
      @reveal="reveal"
    >
      <TakGroupsSettings v-if="selected === 'groups'" :event-id="eventId" :editable="editable" />
      <PresetsSection v-else-if="selected === 'presets'" kind="tak" :event-id="eventId" :editable="editable" :dirty="dirty" @imported="reloadList" />
      <template v-else>
        <AtakRestrictionsSection
          v-if="selected === 'restrictions'"
          v-model:entries="entries"
          :event-id="eventId"
          :catalog="catalog"
          :target-items="targetItems"
          :editable="editable"
          :errors="errors"
        />
        <AtakTargetedSection
          v-else-if="selected === 'targeted'"
          v-model:entries="entries"
          :catalog="catalog"
          :target-items="targetItems"
          :editable="editable"
          :dirty="dirty"
          :importing="importing"
          :import-result="importResult"
          :errors="errors"
          @import="importFile"
        />
        <AtakTopicSection
          v-else-if="currentTopic !== null"
          v-model:entries="entries"
          v-model:show-advanced="showAdvanced"
          :topic="currentTopic"
          :target-titles="targetTitles"
          :editable="editable"
          :errors="errors"
        />

        <v-alert v-if="problemList.length > 0" type="error" variant="tonal" class="mb-4" title="Some settings were not saved">
          <div v-for="problem in problemList" :key="problem">{{ problem }}</div>
        </v-alert>
        <v-slide-y-reverse-transition>
          <v-card v-if="editable && dirty" class="save-bar d-flex align-center ga-3 pa-3 mt-4" elevation="4">
            <span class="text-body-medium flex-grow-1">You have unsaved ATAK settings.</span>
            <v-btn variant="text" :disabled="saving" @click="list !== null && show(list)">Discard</v-btn>
            <v-btn color="primary" :loading="saving" @click="save">Save changes</v-btn>
          </v-card>
        </v-slide-y-reverse-transition>
      </template>
    </SettingsLayout>
  </div>
</template>

<style scoped>
.save-bar {
  position: sticky;
  bottom: 16px;
}
</style>
