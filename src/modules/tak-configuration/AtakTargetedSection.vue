<script setup lang="ts">
import { mdiDeleteOutline, mdiFileImportOutline, mdiPlus } from "@mdi/js";
import { computed, ref } from "vue";
import DataTable from "@/shared/components/DataTable.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import SettingsRow from "@/shared/settings/SettingsRow.vue";
import AddAtakPreferenceDialog from "./AddAtakPreferenceDialog.vue";
import AtakPreferenceValueField from "./AtakPreferenceValueField.vue";
import AtakTargetLabel from "./AtakTargetLabel.vue";
import type { AtakPreferenceCatalogDto, AtakPreferenceEntryDto, ImportAtakPreferencesResponse } from "./tak-configuration.api";
import {
  APP_PREFERENCES,
  entryDescriber,
  entryMessages,
  eventTopics,
  restrictedItemOf,
  targetKey,
  type TargetOption,
} from "./tak-settings";

/**
 * The ATAK settings that have no other home: settings for single groups, roles or members, and
 * whole-event plugin keys or other keys without a topic page. Whole-event settings with a topic
 * page show there and locks under "Lock ATAK settings", so each setting has exactly one place.
 */
const props = defineProps<{
  catalog: AtakPreferenceCatalogDto;
  targetItems: TargetOption[];
  editable: boolean;
  dirty: boolean;
  importing: boolean;
  importResult: ImportAtakPreferencesResponse | null;
  errors: Record<string, string>;
}>();
const entries = defineModel<AtakPreferenceEntryDto[]>("entries", { required: true });
const emit = defineEmits<{ import: [file: File] }>();

const adding = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const order = computed(() => new Map(props.targetItems.map(({ value }, index) => [value, index])));
const options = computed(() => new Map(props.targetItems.map((item) => [item.value, item])));

const topicKeys = computed(() => new Set(eventTopics(props.catalog).flatMap(({ keys }) => keys.map(({ key }) => key))));

function belongsHere(entry: AtakPreferenceEntryDto): boolean {
  if (restrictedItemOf(entry) !== null) {
    return false;
  }
  return entry.target.type !== "event" || entry.preference !== APP_PREFERENCES || !topicKeys.value.has(entry.key);
}

/** This section's entries by target in menu order, keeping each entry's index in the whole list for errors. */
const rows = computed(() =>
  entries.value
    .map((entry, index) => ({ id: `${targetKey(entry.target)}:${entry.preference}:${entry.key}`, entry, index }))
    .filter(({ entry }) => belongsHere(entry))
    .sort(
      (a, b) =>
        (order.value.get(targetKey(a.entry.target)) ?? 0) - (order.value.get(targetKey(b.entry.target)) ?? 0) ||
        a.entry.key.localeCompare(b.entry.key),
    ),
);
const elsewhere = computed(() => ({
  topics: entries.value.filter((entry) => restrictedItemOf(entry) === null && !belongsHere(entry)).length,
  locks: entries.value.filter((entry) => restrictedItemOf(entry) !== null).length,
}));
const skipped = computed(() => (props.importResult?.removedKeys.length ?? 0) + (props.importResult?.invalidKeys.length ?? 0));

const describer = computed(() => entryDescriber(props.catalog));

type TargetedRow = (typeof rows.value)[number];

function targetName(row: TargetedRow): string {
  return options.value.get(targetKey(row.entry.target))?.name ?? "Unknown target";
}

const headers = computed(() => [
  { title: "For", key: "target", value: targetName },
  { title: "Setting", key: "key", value: (row: TargetedRow) => row.entry.key },
  { title: "Value", key: "value", sortable: false, searchable: false },
  ...(props.editable ? [{ title: "Actions", key: "actions", sortable: false, align: "end" as const }] : []),
]);

function targetedSearchText(row: TargetedRow): string[] {
  return [targetName(row), row.entry.key, describer.value.describe(row.entry)];
}

function setValue(index: number, value: string | null): void {
  entries.value = entries.value.map((entry, position) => (position === index ? { ...entry, value: value ?? "" } : entry));
}

function remove(index: number): void {
  entries.value = entries.value.filter((_, position) => position !== index);
}

function onFileChosen(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file !== undefined) {
    emit("import", file);
  }
}
</script>

<template>
  <div>
    <v-card class="mb-4">
      <SettingsRow
        setting-id="tak:import"
        title="Import .pref file"
        description="Set up one ATAK the way it should be, export its settings and import the file. Its settings apply to the whole event and replace whole-event settings with the same key."
      >
        <template #title-append>
          <InfoHint v-if="importResult !== null && skipped > 0" tone="warning" label="Settings left out of the file">
            <p v-if="importResult.removedKeys.length > 0" class="mb-2">
              Left out because OpenMeshTak sets them or they are personal or secret: {{ importResult.removedKeys.join(", ") }}.
            </p>
            <p v-for="item in importResult.invalidKeys" :key="item.key" class="mb-1">{{ item.key }}: {{ item.message }}</p>
          </InfoHint>
        </template>
        <v-btn
          v-if="editable"
          variant="tonal"
          :prepend-icon="mdiFileImportOutline"
          :loading="importing"
          :disabled="dirty"
          @click="fileInput?.click()"
        >
          Import
        </v-btn>
        <input ref="fileInput" type="file" accept=".pref,.xml" hidden @change="onFileChosen">
      </SettingsRow>
      <div v-if="editable && dirty" class="text-body-small text-medium-emphasis px-5 pb-3">Save or discard your changes before importing.</div>
    </v-card>

    <v-card class="mb-4" data-setting-id="tak:add">
      <DataTable
        :headers="headers"
        :items="rows"
        :search-text="targetedSearchText"
        search-label="Search settings"
        no-data-text="No targeted or custom settings. Add a setting for a group, role or member, or a plugin setting."
        storage-key="atak-targeted"
      >
        <template #toolbar>
          <div>
            <div class="text-title-medium font-weight-medium">Targeted & custom settings</div>
            <div class="text-body-small text-medium-emphasis">
              For single groups, roles or members, and plugin or other settings without an ATAK settings page.
              <template v-if="elsewhere.topics > 0">
                {{ elsewhere.topics }} whole-event {{ elsewhere.topics === 1 ? "setting is" : "settings are" }} on the ATAK settings pages.
              </template>
              <template v-if="elsewhere.locks > 0">
                {{ elsewhere.locks }} lock {{ elsewhere.locks === 1 ? "key is" : "keys are" }} under Lock ATAK settings.
              </template>
            </div>
          </div>
        </template>
        <template v-if="editable" #actions>
          <v-btn variant="tonal" :prepend-icon="mdiPlus" @click="adding = true">Add setting</v-btn>
        </template>
        <template #[`item.target`]="{ item }">
          <AtakTargetLabel :target="options.get(targetKey(item.entry.target)) ?? { kind: 'Event', name: 'Unknown target' }" />
        </template>
        <template #[`item.key`]="{ item }">
          <div class="py-2">
            <div><code>{{ item.entry.key }}</code></div>
            <div class="text-body-small text-medium-emphasis">{{ describer.describe(item.entry) }}</div>
          </div>
        </template>
        <template #[`item.value`]="{ item }">
          <div class="value-cell py-2">
            <AtakPreferenceValueField
              :model-value="item.entry.value"
              :label="item.entry.key"
              :definition="describer.definitionOf(item.entry)"
              :type="item.entry.type"
              :clearable="false"
              :disabled="!editable"
              :error-messages="entryMessages(errors, item.index)"
              @update:model-value="setValue(item.index, $event)"
            />
          </div>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn :icon="mdiDeleteOutline" variant="text" size="small" :aria-label="`Remove ${item.entry.key}`" @click="remove(item.index)" />
        </template>
      </DataTable>
    </v-card>

    <AddAtakPreferenceDialog v-model="adding" :catalog="catalog" :target-items="targetItems" :entries="entries" @add="entries = [...entries, ...$event]" />
  </div>
</template>

<style scoped>
.value-cell {
  min-width: 240px;
}
</style>
