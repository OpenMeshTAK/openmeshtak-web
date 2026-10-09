<script setup lang="ts">
import { computed } from "vue";
import SettingsRow from "@/shared/settings/SettingsRow.vue";
import AtakTopicRow from "./AtakTopicRow.vue";
import type { AtakCatalogKeyDto, AtakCatalogTopicDto, AtakPreferenceEntryDto } from "./tak-configuration.api";
import {
  APP_PREFERENCES,
  entryIndex,
  entryMessages,
  targetKey,
  withValue,
  type PreferenceTarget,
} from "./tak-settings";

/**
 * One catalog topic, such as "Display and units", for the whole event, grouped into subgroups such
 * as "Altitude"; advanced settings come last and only on request. Settings for single groups, roles or
 * members live under "Targeted & custom", and each row names them so precedence stays visible.
 */
const props = defineProps<{
  topic: AtakCatalogTopicDto;
  targetTitles: ReadonlyMap<string, string>;
  editable: boolean;
  errors: Record<string, string>;
}>();
const entries = defineModel<AtakPreferenceEntryDto[]>("entries", { required: true });
const showAdvanced = defineModel<boolean>("showAdvanced", { required: true });

/** Topic pages always set values for the whole event. */
const target: PreferenceTarget = { type: "event", id: null };

function isToggle(definition: AtakCatalogKeyDto): boolean {
  return definition.type === "boolean" && definition.values === null;
}

const basic = computed(() => props.topic.keys.filter(({ use }) => use !== "advanced"));
const advanced = computed(() => props.topic.keys.filter(({ use }) => use === "advanced"));
/** Advanced keys that already have a value stay visible, so nothing set is ever hidden. */
const visibleAdvanced = computed(() =>
  advanced.value.filter((definition) => showAdvanced.value || value(definition) !== null),
);
/** The topic's subgroups, such as "Altitude", in catalog order. */
const groups = computed(() => {
  const byGroup = new Map<string, AtakCatalogKeyDto[]>();
  for (const definition of basic.value) {
    byGroup.set(definition.group, [...(byGroup.get(definition.group) ?? []), definition]);
  }
  return [...byGroup].map(([title, keys]) => ({ id: title, title, keys }));
});

/** ATAK's own default in the words the control uses. */
function defaultLabel(definition: AtakCatalogKeyDto): string | null {
  if (definition.defaultValue === null) {
    return null;
  }
  if (isToggle(definition)) {
    return definition.defaultValue === "true" ? "On" : "Off";
  }
  return definition.values?.find((option) => option.value === definition.defaultValue)?.label ?? definition.defaultValue;
}

function value(definition: AtakCatalogKeyDto): string | null {
  return entries.value[entryIndex(entries.value, target, APP_PREFERENCES, definition.key)]?.value ?? null;
}

function update(definition: AtakCatalogKeyDto, next: string | null): void {
  entries.value = withValue(entries.value, target, definition, next);
}

function messages(definition: AtakCatalogKeyDto): string[] {
  const index = entryIndex(entries.value, target, APP_PREFERENCES, definition.key);
  return index < 0 ? [] : entryMessages(props.errors, index);
}

/** The same key for single targets, which win over the whole event for their members. */
function elsewhere(definition: AtakCatalogKeyDto): string {
  const own = targetKey(target);
  const others = entries.value.filter(
    (entry) => entry.preference === APP_PREFERENCES && entry.key === definition.key && targetKey(entry.target) !== own,
  );
  return others
    .map((entry) => {
      const label = definition.values?.find((option) => option.value === entry.value)?.label ?? entry.value;
      return `${props.targetTitles.get(targetKey(entry.target)) ?? "Unknown target"}: ${label}`;
    })
    .join(" · ");
}

</script>

<template>
  <div>
    <template v-for="group in groups" :key="group.id">
      <div class="text-title-small mb-2">{{ group.title }}</div>
      <v-card class="mb-6">
        <template v-for="(definition, index) in group.keys" :key="definition.key">
          <v-divider v-if="index > 0" />
          <AtakTopicRow
            :definition="definition"
            :value="value(definition)"
            :default-label="defaultLabel(definition)"
            :elsewhere="elsewhere(definition)"
            :editable="editable"
            :messages="messages(definition)"
            @update="update(definition, $event)"
          />
        </template>
      </v-card>
    </template>

    <template v-if="advanced.length > 0">
      <div class="text-title-small mb-2">Advanced</div>
      <v-card class="mb-6">
        <SettingsRow
          title="Show advanced settings"
          :description="`${String(advanced.length)} rarely needed settings, such as tuning and troubleshooting options. Those with a value are always shown.`"
        >
          <v-switch v-model="showAdvanced" aria-label="Show advanced settings" color="primary" inset hide-details />
        </SettingsRow>
        <template v-for="definition in visibleAdvanced" :key="definition.key">
          <v-divider />
          <AtakTopicRow
            :definition="definition"
            :value="value(definition)"
            :default-label="defaultLabel(definition)"
            :elsewhere="elsewhere(definition)"
            :editable="editable"
            :messages="messages(definition)"
            @update="update(definition, $event)"
          />
        </template>
      </v-card>
    </template>
  </div>
</template>
