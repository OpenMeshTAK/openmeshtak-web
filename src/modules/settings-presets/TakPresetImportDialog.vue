<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { listGroups, type EventGroupDto } from "@/modules/event-groups/event-groups.api";
import { listRoles, type EventRoleDto } from "@/modules/event-roles/event-roles.api";
import AtakTargetLabel from "@/modules/tak-configuration/AtakTargetLabel.vue";
import { getAtakPreferenceCatalog, type AtakPreferenceCatalogDto } from "@/modules/tak-configuration/tak-configuration.api";
import { entryDescriber, type TargetOption } from "@/modules/tak-configuration/tak-settings";
import {
  importTakPreset,
  previewTakPreset,
  type PresetDocumentDto,
  type PresetTargetMappingDto,
  type TakPresetPreviewDto,
} from "./settings-presets.api";

/**
 * Shows what a TAK preset would add or change in the event's ATAK settings draft. Groups and roles
 * of the preset come from another event, so each one is mapped by hand onto a group or role of this
 * event, or left out, before Core offers a confirmation.
 */
const props = defineProps<{ eventId: string; document: PresetDocumentDto | null }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ imported: [] }>();

/** `skip` leaves a preset target's entries out; `undefined` means not mapped yet. */
const SKIP = "skip";
const preview = ref<TakPresetPreviewDto | null>(null);
const catalog = ref<AtakPreferenceCatalogDto | null>(null);
const groups = ref<EventGroupDto[]>([]);
const roles = ref<EventRoleDto[]>([]);
const choices = ref<Record<string, string | undefined>>({});
const loading = useSubmission();
const importing = useSubmission();

function refOf(target: { type: string; slug: string }): string {
  return `${target.type}:${target.slug}`;
}

const mappings = computed<PresetTargetMappingDto[]>(() =>
  (preview.value?.targets ?? []).flatMap((target) => {
    const choice = choices.value[refOf(target)];
    return choice === undefined ? [] : [{ type: target.type, slug: target.slug, targetId: choice === SKIP ? null : choice }];
  }),
);
const unmapped = computed(() => (preview.value?.targets ?? []).filter((target) => choices.value[refOf(target)] === undefined));
const suggestions = computed(() => unmapped.value.filter((target) => target.suggestedTargetId !== null));

function optionsFor(type: "group" | "role") {
  const items = type === "group" ? groups.value : roles.value;
  return [...items.map(({ id, name }) => ({ title: name, value: id })), { title: "Leave out", value: SKIP }];
}

const describer = computed(() => (catalog.value === null ? null : entryDescriber(catalog.value)));

function targetOption(target: { type: string; id?: string | null }): Pick<TargetOption, "kind" | "name"> {
  if (target.type === "group") {
    return { kind: "Group", name: groups.value.find(({ id }) => id === target.id)?.name ?? "Unknown group" };
  }
  if (target.type === "role") {
    return { kind: "Role", name: roles.value.find(({ id }) => id === target.id)?.name ?? "Unknown role" };
  }
  return { kind: "Event", name: "Whole event" };
}

/** New and changed entries in one list, whole-event entries first, then by setting. */
const changes = computed(() =>
  [
    ...(preview.value?.added ?? []).map((entry) => ({ entry, isNew: true })),
    ...(preview.value?.changed ?? []).map((entry) => ({ entry, isNew: false })),
  ]
    .map(({ entry, isNew }) => ({
      id: `${entry.target.type}:${entry.target.id ?? ""}:${entry.preference}:${entry.key}`,
      isNew,
      key: entry.key,
      target: targetOption(entry.target),
      description: describer.value?.describe(entry) ?? entry.key,
      from: entry.from === null ? null : (describer.value?.valueLabel(entry, entry.from) ?? entry.from),
      to: describer.value?.valueLabel(entry, entry.to) ?? entry.to,
    }))
    .sort((a, b) => Number(a.target.kind !== "Event") - Number(b.target.kind !== "Event") || a.description.localeCompare(b.description)),
);
const addedCount = computed(() => preview.value?.added.length ?? 0);
const changedCount = computed(() => preview.value?.changed.length ?? 0);
const changeCount = computed(() => addedCount.value + changedCount.value);
const wholeEventCount = computed(() => changes.value.filter(({ target }) => target.kind === "Event").length);
const leftOut = computed(() => (preview.value?.invalid.length ?? 0) + (preview.value?.skipped ?? 0));

async function refresh(): Promise<void> {
  if (props.document === null) {
    return;
  }
  const document = props.document;
  const result = await loading.run(() => previewTakPreset(props.eventId, document, mappings.value));
  preview.value = result?.value ?? null;
}

watch(open, async (isOpen) => {
  if (!isOpen) {
    return;
  }
  preview.value = null;
  choices.value = {};
  importing.reset();
  const loaded = await loading.run(() => Promise.all([listGroups(props.eventId), listRoles(props.eventId), getAtakPreferenceCatalog()]));
  if (loaded !== null) {
    [groups.value, roles.value, catalog.value] = loaded.value;
    await refresh();
  }
});

function choose(target: { type: string; slug: string }, value: string | null | undefined): void {
  if (value === null || value === undefined) {
    return;
  }
  choices.value = { ...choices.value, [refOf(target)]: value };
  void refresh();
}

function useSuggestions(): void {
  const next = { ...choices.value };
  for (const target of suggestions.value) {
    next[refOf(target)] = target.suggestedTargetId ?? undefined;
  }
  choices.value = next;
  void refresh();
}

async function confirm(): Promise<void> {
  if (preview.value === null || preview.value.confirmation === null || props.document === null) {
    return;
  }
  const body = { version: preview.value.version, document: props.document, mappings: mappings.value, confirmation: preview.value.confirmation };
  const result = await importing.run(() => importTakPreset(props.eventId, body));
  if (result !== null) {
    open.value = false;
    emit("imported");
  } else if (importing.code.value === "VERSION_CONFLICT" || importing.code.value === "PRESET_IMPORT_UNCONFIRMED") {
    const message = importing.error.value;
    await refresh();
    importing.error.value = `${message ?? ""} The preview was updated; check it and import again.`.trim();
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="900" scrollable>
    <v-card>
      <v-card-title class="text-title-large font-weight-medium text-wrap pt-5 px-6 pb-1">Import “{{ document?.name }}”</v-card-title>
      <div v-if="preview !== null" class="text-body-medium text-medium-emphasis px-6 d-flex align-center ga-1 flex-wrap">
        Checked against the ATAK {{ preview.catalogAtakVersion }} catalog. Importing changes the draft only.
        <InfoHint
          v-if="preview.presetAtakVersion !== null && preview.presetAtakVersion !== preview.catalogAtakVersion"
          tone="warning"
          label="Different ATAK version"
          :text="`The preset was made for ATAK ${preview.presetAtakVersion}. Keys or values this catalog rejects are left out.`"
        />
      </div>

      <v-card-text class="px-6 pt-4">
        <v-skeleton-loader v-if="loading.submitting.value && preview === null" type="list-item@4" />
        <v-alert v-if="loading.error.value" type="error" variant="tonal" class="mb-4">
          {{ loading.error.value }}
          <div v-for="(message, field) in loading.fields.value" :key="field" class="text-body-small">{{ field }}: {{ message }}</div>
        </v-alert>

        <template v-if="preview !== null">
          <div class="summary mb-5">
            <div class="summary__item">
              <div class="text-headline-small">{{ addedCount }}</div>
              <div class="text-body-small text-medium-emphasis">New</div>
            </div>
            <div class="summary__item">
              <div class="text-headline-small">{{ changedCount }}</div>
              <div class="text-body-small text-medium-emphasis">Changed</div>
            </div>
            <div class="summary__item">
              <div class="text-headline-small">{{ preview.unchanged }}</div>
              <div class="text-body-small text-medium-emphasis">Already the same</div>
            </div>
            <div class="summary__item">
              <div class="text-headline-small" :class="{ 'text-warning': leftOut > 0 }">{{ leftOut }}</div>
              <div class="text-body-small text-medium-emphasis">Left out</div>
            </div>
          </div>

          <section v-if="preview.targets.length > 0" class="mb-5">
            <div class="d-flex align-center ga-2 mb-1">
              <h3 class="text-title-small font-weight-medium flex-grow-1 my-0">Groups and roles of the preset</h3>
              <v-btn v-if="suggestions.length > 0" size="small" variant="tonal" @click="useSuggestions">Use matching names</v-btn>
            </div>
            <p class="text-body-small text-medium-emphasis mt-0 mb-2">
              The preset comes from another event. Choose which group or role of this event gets each one's settings, or leave them out.
            </p>
            <v-card class="mapping">
              <div v-for="target in preview.targets" :key="refOf(target)" class="mapping__row">
                <div class="mapping__source">
                  <AtakTargetLabel :target="{ kind: target.type === 'group' ? 'Group' : 'Role', name: target.name }" />
                  <div class="text-body-small text-medium-emphasis">{{ target.entryCount }} {{ target.entryCount === 1 ? "setting" : "settings" }}</div>
                </div>
                <v-select
                  :model-value="choices[refOf(target)]"
                  :items="optionsFor(target.type)"
                  :label="target.type === 'group' ? 'Group in this event' : 'Role in this event'"
                  density="compact"
                  hide-details
                  class="mapping__select"
                  @update:model-value="choose(target, $event)"
                />
              </div>
            </v-card>
            <p v-if="unmapped.length > 0" class="text-body-small text-medium-emphasis mt-2 mb-0">
              Map or leave out every group and role to import.
            </p>
          </section>

          <section class="mb-4">
            <h3 class="text-title-small font-weight-medium mt-0 mb-1">Changes</h3>
            <p v-if="changes.length === 0" class="text-body-medium text-medium-emphasis my-0">
              <template v-if="unmapped.length === 0">Nothing would change; the event already has these settings.</template>
              <template v-else>Changes show once every group and role is mapped or left out.</template>
            </p>
            <template v-else>
              <p class="text-body-small text-medium-emphasis mt-0 mb-2">
                <template v-if="wholeEventCount > 0">Whole-event settings appear on the ATAK settings pages. </template>
                <template v-if="wholeEventCount < changes.length">Group and role settings appear under Targeted & custom. </template>
                Each one replaces this event's value for the same target and setting; other settings stay.
              </p>
              <v-card>
                <v-table density="compact" class="changes">
                  <thead>
                    <tr>
                      <th>For</th>
                      <th>Setting</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="change in changes" :key="change.id">
                      <td class="text-no-wrap"><AtakTargetLabel :target="change.target" /></td>
                      <td>
                        <div>{{ change.description }}</div>
                        <code class="text-body-small text-medium-emphasis">{{ change.key }}</code>
                      </td>
                      <td class="changes__value">
                        <v-chip v-if="change.isNew" size="x-small" label variant="tonal" color="success" class="mr-2">New</v-chip>
                        <template v-else><span class="text-medium-emphasis">{{ change.from ?? "—" }}</span> → </template>
                        <span class="font-weight-medium">{{ change.to }}</span>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card>
            </template>
          </section>

          <v-alert v-if="preview.invalid.length > 0" type="warning" variant="tonal" density="compact" class="mb-2">
            <div class="font-weight-medium mb-1">{{ preview.invalid.length }} left out because the ATAK catalog or this event rejects them</div>
            <div v-for="(entry, index) in preview.invalid" :key="`${index}:${entry.key}`" class="text-body-small">
              <code>{{ entry.key }}</code>
              ({{ entry.target.type === "event" ? "Whole event" : `${entry.target.type} ${entry.target.name ?? entry.target.slug ?? ""}` }}): {{ entry.message }}
            </div>
          </v-alert>
          <p v-if="preview.skipped > 0" class="text-body-small text-medium-emphasis my-0">
            {{ preview.skipped }} {{ preview.skipped === 1 ? "setting is" : "settings are" }} left out by the group and role choices.
          </p>
        </template>
        <v-alert v-if="importing.error.value" type="error" variant="tonal" class="mt-4">{{ importing.error.value }}</v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <span class="text-body-small text-medium-emphasis">Publish the configuration afterwards so members get it.</span>
        <v-spacer />
        <v-btn variant="text" :disabled="importing.submitting.value" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          :loading="importing.submitting.value"
          :disabled="preview === null || preview.confirmation === null || changeCount === 0 || loading.submitting.value"
          @click="confirm"
        >
          Import {{ changeCount }} {{ changeCount === 1 ? "change" : "changes" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.summary__item {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mapping__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px 14px;
}
.mapping__row + .mapping__row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mapping__source {
  flex: 1 1 200px;
  min-width: 0;
}
.mapping__select {
  flex: 1 1 260px;
}
.changes td {
  vertical-align: top;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  overflow-wrap: anywhere;
}
.changes__value {
  min-width: 160px;
}
@media (max-width: 599px) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
