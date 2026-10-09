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
import { APP_PREFERENCES, entryMessages, targetKey, type TargetOption } from "./tak-settings";

/**
 * Every ATAK setting of the event at once, for all targets: the place for plugin keys and other
 * keys without a ready field, and for importing a `.pref` file.
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
const known = computed(() => new Map(props.catalog.topics.flatMap(({ keys }) => keys.map((entry) => [entry.key, entry] as const))));
const order = computed(() => new Map(props.targetItems.map(({ value }, index) => [value, index])));
const options = computed(() => new Map(props.targetItems.map((item) => [item.value, item])));

/** Entries by target in menu order, keeping each entry's index in the whole list for errors. */
const rows = computed(() =>
  entries.value
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        (order.value.get(targetKey(a.entry.target)) ?? 0) - (order.value.get(targetKey(b.entry.target)) ?? 0) ||
        a.entry.key.localeCompare(b.entry.key),
    ),
);
const skipped = computed(() => (props.importResult?.removedKeys.length ?? 0) + (props.importResult?.invalidKeys.length ?? 0));

function definitionOf(entry: AtakPreferenceEntryDto) {
  return entry.preference === APP_PREFERENCES ? (known.value.get(entry.key) ?? null) : null;
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
          variant="outlined"
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
          <div class="text-title-medium">All settings</div>
          <div class="text-body-small text-medium-emphasis">{{ entries.length }} {{ entries.length === 1 ? "setting" : "settings" }} for this event</div>
        </div>
        <v-btn v-if="editable" variant="outlined" :prepend-icon="mdiPlus" @click="adding = true">Add setting</v-btn>
      </div>
      <EmptyState
        v-if="entries.length === 0"
        :icon="mdiPlus"
        title="No ATAK settings yet"
        text="Choose values in the topics on the left, add any setting here, including plugin settings, or import a .pref file."
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
                {{
                  definitionOf(entry)?.description ??
                    (entry.preference === APP_PREFERENCES ? `Not in the catalog · ${entry.type}` : `${entry.preference} · ${entry.type}`)
                }}
              </div>
            </td>
            <td class="py-2 value-cell">
              <AtakPreferenceValueField
                :model-value="entry.value"
                :label="entry.key"
                :definition="definitionOf(entry)"
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
