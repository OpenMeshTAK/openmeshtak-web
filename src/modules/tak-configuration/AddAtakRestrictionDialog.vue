<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SegmentedControl from "@/shared/components/SegmentedControl.vue";
import AtakTargetLabel from "./AtakTargetLabel.vue";
import type { AtakPreferenceCatalogDto } from "./tak-configuration.api";
import { lockableItems, RESTRICTION_MODES, targetOf, type PreferenceTarget, type RestrictionMode, type TargetOption } from "./tak-settings";

/**
 * Locks one or more ATAK settings items for one or more targets: the catalog's settings and the
 * extra screen items Core knows, such as the callsign field or the server connections screen.
 */
const props = defineProps<{
  catalog: AtakPreferenceCatalogDto;
  targetItems: TargetOption[];
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ add: [targets: PreferenceTarget[], itemIds: string[], mode: RestrictionMode] }>();

const selectedTargets = ref<string[]>([]);
const selectedItems = ref<string[]>([]);
const mode = ref<RestrictionMode>("disabled");

watch(open, (isOpen) => {
  if (isOpen) {
    selectedTargets.value = ["event"];
    selectedItems.value = [];
    mode.value = "disabled";
  }
});

/** Every lockable item under its area, the screen items first. */
const items = computed(() => {
  const byArea = new Map<string, Array<{ title: string; value: string; props: { subtitle: string } }>>();
  for (const item of lockableItems(props.catalog)) {
    byArea.set(item.area, [...(byArea.get(item.area) ?? []), { title: item.label, value: item.id, props: { subtitle: item.id } }]);
  }
  return [...byArea].flatMap(([area, list]) => [{ type: "subheader" as const, title: area }, ...list]);
});
const canAdd = computed(() => selectedTargets.value.length > 0 && selectedItems.value.length > 0);

function add(): void {
  if (!canAdd.value) {
    return;
  }
  emit("add", selectedTargets.value.map(targetOf), selectedItems.value, mode.value);
  open.value = false;
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card>
      <v-card-title>Lock settings in ATAK</v-card-title>
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
        <v-autocomplete v-model="selectedItems" :items="items" label="Settings" multiple chips closable-chips class="mb-2" />
        <SegmentedControl v-model="mode" :options="RESTRICTION_MODES" label="Lock" size="default" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!canAdd" @click="add">Lock</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
