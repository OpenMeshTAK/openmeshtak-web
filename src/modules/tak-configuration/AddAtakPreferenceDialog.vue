<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AtakPreferenceValueField from "./AtakPreferenceValueField.vue";
import AtakTargetLabel from "./AtakTargetLabel.vue";
import type { AtakPreferenceCatalogDto, AtakPreferenceEntryDto } from "./tak-configuration.api";
import { APP_PREFERENCES, entryIndex, targetOf, type TargetOption } from "./tak-settings";

/**
 * Adds one setting for one or more targets: a key from the catalog, or any other key such as a
 * plugin setting with its group and type. Keys OpenMeshTak owns are refused right away.
 */
const props = defineProps<{
  catalog: AtakPreferenceCatalogDto;
  targetItems: TargetOption[];
  entries: AtakPreferenceEntryDto[];
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ add: [entries: AtakPreferenceEntryDto[]] }>();

const TYPES: Array<AtakPreferenceEntryDto["type"]> = ["string", "boolean", "integer", "long", "float"];

const selectedTargets = ref<string[]>([]);
const key = ref<string | null>(null);
const preference = ref(APP_PREFERENCES);
const type = ref<AtakPreferenceEntryDto["type"]>("string");
const value = ref<string | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    selectedTargets.value = [];
    key.value = null;
    preference.value = APP_PREFERENCES;
    type.value = "string";
    value.value = null;
  }
});

const targets = computed(() => selectedTargets.value.map(targetOf));
const onlyMembers = computed(() => targets.value.length > 0 && targets.value.every(({ type }) => type === "member"));
const known = computed(() => new Map(props.catalog.topics.flatMap(({ keys }) => keys.map((entry) => [entry.key, entry] as const))));
const blocked = computed(() => new Map(props.catalog.blockedKeys.map(({ key: name, reason }) => [name, reason])));

/** Every catalog key under its topic; personal keys only when all chosen targets are members. */
const items = computed(() =>
  props.catalog.topics.flatMap((topic) => {
    const keys = topic.keys.filter((entry) => entry.use !== "member" || onlyMembers.value);
    return keys.length === 0
      ? []
      : [
          { type: "subheader" as const, title: topic.title },
          ...keys.map((entry) => ({
            title: entry.key,
            value: entry.key,
            props: { subtitle: entry.use === "advanced" ? `Advanced · ${entry.description}` : entry.description },
          })),
        ];
  }),
);

const trimmedKey = computed(() => (key.value ?? "").trim());
const definition = computed(() => (preference.value === APP_PREFERENCES ? (known.value.get(trimmedKey.value) ?? null) : null));
const keyProblem = computed(() => {
  const reason = blocked.value.get(trimmedKey.value);
  if (reason !== undefined) {
    return `${reason}.`;
  }
  if (/password/i.test(trimmedKey.value)) {
    return "Passwords are never sent.";
  }
  if (definition.value?.use === "member" && !onlyMembers.value) {
    return "This personal value can only be set for members.";
  }
  const taken = props.targetItems.filter(
    (item) =>
      selectedTargets.value.includes(item.value) &&
      entryIndex(props.entries, targetOf(item.value), preference.value.trim(), trimmedKey.value) >= 0,
  );
  return trimmedKey.value !== "" && taken.length > 0 ? `Already set for ${taken.map(({ name }) => name).join(", ")}.` : null;
});
const effectiveType = computed(() => definition.value?.type ?? type.value);
const canAdd = computed(
  () => targets.value.length > 0 && trimmedKey.value !== "" && preference.value.trim() !== "" && keyProblem.value === null && value.value !== null,
);

function add(): void {
  if (!canAdd.value || value.value === null) {
    return;
  }
  const entry = { preference: preference.value.trim(), key: trimmedKey.value, type: effectiveType.value, value: value.value };
  emit(
    "add",
    targets.value.map((target) => ({ target, ...entry })),
  );
  open.value = false;
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card>
      <v-card-title>Add a setting</v-card-title>
      <v-card-text>
        <v-autocomplete
          v-model="selectedTargets"
          :items="targetItems"
          item-value="value"
          :item-title="(item: TargetOption) => `${item.kind} ${item.name} ${item.detail ?? ''}`"
          label="For"
          multiple
          chips
          closable-chips
          hint="Choose one or more targets; each gets the same value."
          persistent-hint
          class="mb-2"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" title="">
              <AtakTargetLabel :target="item" />
            </v-list-item>
          </template>
          <template #chip="{ props: chipProps, item }">
            <v-chip v-bind="chipProps" text="" size="small">
              <AtakTargetLabel :target="item" />
            </v-chip>
          </template>
        </v-autocomplete>
        <v-combobox
          v-model="key"
          :items="items"
          label="Key"
          :return-object="false"
          :error-messages="keyProblem === null ? [] : [keyProblem]"
          hint="Pick a known ATAK key or type any other key, such as a plugin setting."
          persistent-hint
        />
        <p v-if="definition !== null" class="text-body-medium mb-4">{{ definition.description }}</p>
        <v-row v-else-if="trimmedKey !== ''" dense>
          <v-col cols="12" sm="8">
            <v-text-field v-model="preference" label="Preference group" />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select v-model="type" :items="TYPES" label="Type" />
          </v-col>
        </v-row>
        <AtakPreferenceValueField
          v-if="trimmedKey !== ''"
          v-model="value"
          label="Value"
          :definition="definition"
          :type="effectiveType"
          :clearable="false"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!canAdd" @click="add">Add</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
