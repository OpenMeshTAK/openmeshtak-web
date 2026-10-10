<script setup lang="ts">
import { mdiDeleteOutline, mdiFileImportOutline, mdiPlus } from "@mdi/js";
import { computed, ref } from "vue";
import EmptyState from "@/shared/components/EmptyState.vue";
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
    .map((entry, index) => ({ entry, index }))
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
      <div v-if="editable && dirty" class="text-body-small text-medium-emphasis px-4 pb-3">Save or discard your changes before importing.</div>
    </v-card>

    <v-card class="mb-4" data-setting-id="tak:add">
      <div class="d-flex align-center pa-4 pb-2">
        <div class="flex-grow-1">
          <div class="text-title-medium">Targeted & custom settings</div>
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
        <v-btn v-if="editable" variant="tonal" :prepend-icon="mdiPlus" @click="adding = true">Add setting</v-btn>
      </div>
      <EmptyState
        v-if="rows.length === 0"
        :icon="mdiPlus"
        title="No targeted or custom settings"
        text="Add a setting for a group, role or member, or a plugin setting. Whole-event settings are chosen on the ATAK settings pages on the left."
      />
      <v-table v-else density="comfortable">
        <thead>
          <tr>
            <th>For</th>
            <th>Setting</th>
            <th>Value</th>
            <th v-if="editable"><span class="d-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ entry, index } in rows" :key="`${targetKey(entry.target)}:${entry.preference}:${entry.key}`">
            <td>
              <AtakTargetLabel :target="options.get(targetKey(entry.target)) ?? { kind: 'Event', name: 'Unknown target' }" />
            </td>
            <td class="py-2">
              <div><code>{{ entry.key }}</code></div>
              <div class="text-body-small text-medium-emphasis">
                {{ describer.describe(entry) }}
              </div>
            </td>
            <td class="py-2 value-cell">
              <AtakPreferenceValueField
                :model-value="entry.value"
                :label="entry.key"
                :definition="describer.definitionOf(entry)"
                :type="entry.type"
                :clearable="false"
                :disabled="!editable"
                :error-messages="entryMessages(errors, index)"
                @update:model-value="setValue(index, $event)"
              />
            </td>
            <td v-if="editable" class="text-right">
              <v-btn :icon="mdiDeleteOutline" variant="text" size="small" :aria-label="`Remove ${entry.key}`" @click="remove(index)" />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <AddAtakPreferenceDialog v-model="adding" :catalog="catalog" :target-items="targetItems" :entries="entries" @add="entries = [...entries, ...$event]" />
  </div>
</template>

<style scoped>
.value-cell {
  min-width: 240px;
}
</style>
