<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSubmission } from "@/shared/composables/useSubmission";
import { listGroups, type EventGroupDto } from "@/modules/event-groups/event-groups.api";
import { listRoles, type EventRoleDto } from "@/modules/event-roles/event-roles.api";
import PresetPreviewList from "./PresetPreviewList.vue";
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

const targetNames = computed(
  () => new Map([...groups.value.map(({ id, name }) => [id, `Group ${name}`] as const), ...roles.value.map(({ id, name }) => [id, `Role ${name}`] as const)]),
);

function targetLabel(target: { type: string; id?: string | null }): string {
  return target.type === "event" ? "Whole event" : (targetNames.value.get(target.id ?? "") ?? target.type);
}

const added = computed(() =>
  (preview.value?.added ?? []).map((entry) => ({ key: `${refOf({ type: entry.target.type, slug: entry.target.id ?? "" })}:${entry.key}`, title: entry.key, detail: `${targetLabel(entry.target)}: ${entry.to}` })),
);
const changed = computed(() =>
  (preview.value?.changed ?? []).map((entry) => ({
    key: `${refOf({ type: entry.target.type, slug: entry.target.id ?? "" })}:${entry.key}`,
    title: entry.key,
    detail: `${targetLabel(entry.target)}: ${entry.from ?? "—"} → ${entry.to}`,
  })),
);
const invalid = computed(() =>
  (preview.value?.invalid ?? []).map((entry, index) => ({
    key: `${String(index)}:${entry.key}`,
    title: entry.key,
    detail: `${entry.target.type === "event" ? "Whole event" : `${entry.target.type} ${entry.target.name ?? entry.target.slug ?? ""}`}: ${entry.message}`,
  })),
);
const changeCount = computed(() => added.value.length + changed.value.length);

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
  const loaded = await loading.run(() => Promise.all([listGroups(props.eventId), listRoles(props.eventId)]));
  if (loaded !== null) {
    [groups.value, roles.value] = loaded.value;
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
  <v-dialog v-model="open" max-width="820" scrollable>
    <v-card>
      <v-card-title class="text-title-large font-weight-medium text-wrap pt-4 px-6">Import “{{ document?.name }}”</v-card-title>
      <v-card-text class="px-6">
        <v-skeleton-loader v-if="loading.submitting.value && preview === null" type="list-item@4" />
        <v-alert v-if="loading.error.value" type="error" variant="tonal" class="mb-4">
          {{ loading.error.value }}
          <div v-for="(message, field) in loading.fields.value" :key="field" class="text-body-small">{{ field }}: {{ message }}</div>
        </v-alert>
        <template v-if="preview !== null">
          <p class="text-body-medium mt-0 mb-4">
            Checked against the ATAK {{ preview.catalogAtakVersion }} catalog.
            <InfoHint
              v-if="preview.presetAtakVersion !== null && preview.presetAtakVersion !== preview.catalogAtakVersion"
              tone="warning"
              label="Different ATAK version"
              :text="`The preset was made for ATAK ${preview.presetAtakVersion}. Keys or values this catalog rejects are left out.`"
            />
            Entries replace this event's entry for the same target and key; other entries stay.
          </p>

          <section v-if="preview.targets.length > 0" class="mb-4">
            <h3 class="text-title-small font-weight-medium d-flex align-center ga-1 mb-2">
              Groups and roles
              <InfoHint text="The preset comes from another event. Choose which group or role of this event receives each one's settings, or leave them out." />
              <v-spacer />
              <v-btn v-if="suggestions.length > 0" size="small" variant="text" @click="useSuggestions">Use matching names</v-btn>
            </h3>
            <div v-for="target in preview.targets" :key="refOf(target)" class="d-flex align-center ga-4 mb-2 flex-wrap">
              <div class="mapping-source">
                <div>{{ target.type === "group" ? "Group" : "Role" }} {{ target.name }}</div>
                <div class="text-body-small text-medium-emphasis">{{ target.entryCount }} {{ target.entryCount === 1 ? "setting" : "settings" }}</div>
              </div>
              <v-select
                :model-value="choices[refOf(target)]"
                :items="optionsFor(target.type)"
                :label="`This event's ${target.type}`"
                density="compact"
                hide-details
                class="mapping-select"
                @update:model-value="choose(target, $event)"
              />
            </div>
          </section>

          <v-alert v-if="unmapped.length > 0" type="info" variant="tonal" density="compact" class="mb-4">
            Map or leave out every group and role to import.
          </v-alert>

          <PresetPreviewList title="New settings" :items="added" />
          <PresetPreviewList title="Changed settings" :items="changed" />
          <p v-if="changeCount === 0 && unmapped.length === 0" class="text-body-medium text-medium-emphasis">Nothing would change; the event already has these settings.</p>
          <PresetPreviewList
            title="Left out: invalid"
            hint="The ATAK catalog or this event rejects these entries, for example keys OpenMeshTak sets itself or values only one member may have."
            warning
            :items="invalid"
          />
          <p class="text-body-medium text-medium-emphasis mb-0">
            {{ preview.unchanged }} already the same<template v-if="preview.skipped > 0"> · {{ preview.skipped }} left out by mapping</template>. Importing changes
            the draft only. Publish the configuration so members get it.
          </p>
        </template>
        <v-alert v-if="importing.error.value" type="error" variant="tonal" class="mt-4">{{ importing.error.value }}</v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
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
.mapping-source {
  flex: 1 1 200px;
  min-width: 0;
}
.mapping-select {
  flex: 1 1 260px;
}
</style>
