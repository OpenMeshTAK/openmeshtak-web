<script setup lang="ts">
import { mdiDeleteOutline, mdiDownload, mdiPlus } from "@mdi/js";
import { computed, ref } from "vue";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";
import DataTable from "@/shared/components/DataTable.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useToast } from "@/shared/feedback/toast";
import { saveFile } from "@/shared/files/save-file";
import SettingsRow from "@/shared/settings/SettingsRow.vue";
import AddAtakRestrictionDialog from "./AddAtakRestrictionDialog.vue";
import AtakTargetLabel from "./AtakTargetLabel.vue";
import { downloadAtakUnlockPackage, type AtakPreferenceCatalogDto, type AtakPreferenceEntryDto } from "./tak-configuration.api";
import {
  entryMessages,
  lockableItems,
  restrictedItemOf,
  restrictionMode,
  RESTRICTION_MODES,
  targetKey,
  withRestriction,
  type PreferenceTarget,
  type RestrictionMode,
  type TargetOption,
} from "./tak-settings";

/**
 * Settings items that ATAK greys out or hides on its settings screens, for the whole event or
 * single groups, roles and members, and the package that makes them normal again after the event.
 */
const props = defineProps<{
  eventId: string;
  catalog: AtakPreferenceCatalogDto;
  targetItems: TargetOption[];
  editable: boolean;
  errors: Record<string, string>;
}>();
const entries = defineModel<AtakPreferenceEntryDto[]>("entries", { required: true });
const toast = useToast();

const adding = ref(false);
const downloading = ref(false);
const items = computed(() => new Map(lockableItems(props.catalog).map((item) => [item.id, item])));
const order = computed(() => new Map(props.targetItems.map(({ value }, index) => [value, index])));
const options = computed(() => new Map(props.targetItems.map((item) => [item.value, item])));

/** One row per target and item, with the positions of both keys for Core's messages. */
const rows = computed(() => {
  const byRow = new Map<string, { target: PreferenceTarget; itemId: string; indexes: number[] }>();
  entries.value.forEach((entry, index) => {
    const itemId = restrictedItemOf(entry);
    if (itemId === null) {
      return;
    }
    const id = `${targetKey(entry.target)}|${itemId}`;
    const row = byRow.get(id) ?? { target: entry.target, itemId, indexes: [] };
    row.indexes.push(index);
    byRow.set(id, row);
  });
  return [...byRow.entries()]
    .map(([id, row]) => ({ id, ...row, mode: restrictionMode(entries.value, row.target, row.itemId) ?? "normal" }))
    .sort(
      (a, b) =>
        (order.value.get(targetKey(a.target)) ?? 0) - (order.value.get(targetKey(b.target)) ?? 0) ||
        a.itemId.localeCompare(b.itemId),
    );
});

type RestrictionRow = (typeof rows.value)[number];

function targetName(target: PreferenceTarget): string {
  return options.value.get(targetKey(target))?.name ?? "Unknown target";
}

const headers = computed(() => [
  { title: "For", key: "target", value: (row: RestrictionRow) => targetName(row.target) },
  { title: "Setting", key: "itemId", value: (row: RestrictionRow) => items.value.get(row.itemId)?.label ?? row.itemId },
  { title: "In ATAK", key: "mode" },
  ...(props.editable ? [{ title: "Actions", key: "actions", sortable: false, align: "end" as const }] : []),
]);

function restrictionSearchText(row: RestrictionRow): (string | undefined)[] {
  const item = items.value.get(row.itemId);
  return [targetName(row.target), item?.label, item?.area, row.itemId, row.mode];
}

function setMode(target: PreferenceTarget, itemId: string, mode: RestrictionMode | null): void {
  entries.value = withRestriction(entries.value, target, itemId, mode);
}

function add(targets: PreferenceTarget[], itemIds: string[], mode: RestrictionMode): void {
  let next = entries.value;
  for (const target of targets) {
    for (const itemId of itemIds) {
      next = withRestriction(next, target, itemId, mode);
    }
  }
  entries.value = next;
}

function messages(indexes: number[]): string[] {
  return indexes.flatMap((index) => entryMessages(props.errors, index));
}

async function download(): Promise<void> {
  downloading.value = true;
  try {
    const { blob, fileName } = await downloadAtakUnlockPackage(props.eventId);
    saveFile(blob, fileName);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <div>
    <v-card class="mb-4">
      <SettingsRow
        setting-id="tak:unlock"
        title="Unlock package"
        description="Makes every item this event ever locked normal again, also locks removed since. Import it in ATAK after the event."
      >
        <template #hint>
          <p class="mb-2">
            The package sets each item's lock to off. It holds no values and no secrets, so it can be shared with every
            participant.
          </p>
          <p class="mb-0">
            ATAK's own settings search does not list items whose hidden lock is off, and still lists hidden ones; the items
            themselves show normally on their screens.
          </p>
        </template>
        <v-btn variant="tonal" :prepend-icon="mdiDownload" :loading="downloading" @click="download">Download</v-btn>
        <DownloadQrButton :request="{ kind: 'atak-unlock-package', eventId }" file-label="the ATAK unlock package" />
      </SettingsRow>
    </v-card>

    <v-card class="mb-4" data-setting-id="tak:restrictions">
      <DataTable
        :headers="headers"
        :items="rows"
        :search-text="restrictionSearchText"
        search-label="Search locked settings"
        no-data-text="No locked settings. Lock settings here or with the lock next to a setting in its topic."
        storage-key="atak-restrictions"
      >
        <template #toolbar>
          <div>
            <div class="d-flex align-center ga-1 text-title-medium">
              Locked settings
              <InfoHint label="About locked settings">
                <p class="mb-2">
                  Greyed out items stay visible but cannot be changed; hidden items disappear from the settings screen together
                  with the items that depend on them.
                </p>
                <p class="mb-0">
                  Normal makes a locked item usable again on the next publish. Removing a row sends nothing, so devices keep the
                  lock they have.
                </p>
              </InfoHint>
              <InfoHint tone="warning" label="Limits of locking">
                <p class="mb-2">
                  Locking only greys out or hides items on ATAK's settings screens. It is not tamper-proof: toolbars, imported
                  files and other apps can still change the values.
                </p>
                <p class="mb-0">
                  Locks apply to the whole ATAK app, not only this event, and stay on the device after the event until the
                  unlock package is imported.
                </p>
              </InfoHint>
            </div>
            <div class="text-body-small text-medium-emphasis">Members get changes once the configuration is published.</div>
          </div>
        </template>
        <template v-if="editable" #actions>
          <v-btn variant="tonal" :prepend-icon="mdiPlus" @click="adding = true">Lock settings</v-btn>
        </template>
        <template #[`item.target`]="{ item }">
          <AtakTargetLabel :target="options.get(targetKey(item.target)) ?? { kind: 'Event', name: 'Unknown target' }" />
        </template>
        <template #[`item.itemId`]="{ item }">
          <div class="py-2">
            <div>{{ items.get(item.itemId)?.label ?? item.itemId }}</div>
            <div class="text-body-small text-medium-emphasis">
              {{ items.get(item.itemId)?.area ?? "Unknown item" }} · <code>{{ item.itemId }}</code>
            </div>
            <div v-for="message in messages(item.indexes)" :key="message" class="text-body-small text-error">{{ message }}</div>
          </div>
        </template>
        <template #[`item.mode`]="{ item }">
          <div class="mode-cell py-2">
            <v-select
              :model-value="item.mode"
              :items="RESTRICTION_MODES"
              :aria-label="`Lock for ${items.get(item.itemId)?.label ?? item.itemId}`"
              :disabled="!editable"
              density="compact"
              hide-details
              @update:model-value="setMode(item.target, item.itemId, $event)"
            />
          </div>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn
            :icon="mdiDeleteOutline"
            variant="text"
            size="small"
            :aria-label="`Remove the lock of ${item.itemId}`"
            @click="setMode(item.target, item.itemId, null)"
          />
        </template>
      </DataTable>
    </v-card>

    <AddAtakRestrictionDialog v-model="adding" :catalog="catalog" :target-items="targetItems" @add="add" />
  </div>
</template>

<style scoped>
.mode-cell {
  min-width: 180px;
}
</style>
