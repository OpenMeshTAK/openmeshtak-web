<script setup lang="ts">
import { ref, toRaw, watch } from "vue";
import EventAudiencePicker from "@/modules/event-audience/EventAudiencePicker.vue";
import { memberOptions, type AudienceOptions, type EventAudience } from "@/modules/event-audience/audience-options";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import {
  updateMissionWriters,
  updatePackageAudience,
  type DataPackageDto,
  type PackageAudience,
} from "@/modules/data-packages/data-packages.api";

/**
 * Who sees a mission in their TAK app and who may change it from there. The editor keeps its own
 * permissions; writers only matter for changes made in TAK apps.
 */
const open = defineModel<boolean>({ required: true });
const props = defineProps<{ eventId: string; mission: DataPackageDto; options: AudienceOptions }>();
const emit = defineEmits<{ saved: [mission: DataPackageDto] }>();

const EMPTY: EventAudience = { groupIds: [], roleIds: [], memberIds: [] };

function hasWriters(selection: EventAudience): boolean {
  return selection.groupIds.length + selection.roleIds.length + selection.memberIds.length > 0;
}

const audience = ref<PackageAudience>(structuredClone(toRaw(props.mission.audience)));
const writers = ref<EventAudience>(structuredClone(toRaw(props.mission.writers)));
/** Writers have no "everyone" option: nobody, or a selection. */
const writersSelected = ref(hasWriters(props.mission.writers));
const saving = ref(false);
const formError = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (isOpen) {
    // The mission comes from reactive state and structuredClone cannot copy Vue proxies.
    audience.value = structuredClone(toRaw(props.mission.audience));
    writers.value = structuredClone(toRaw(props.mission.writers));
    writersSelected.value = hasWriters(writers.value);
    formError.value = null;
    fields.value = {};
  }
});

async function save(): Promise<void> {
  saving.value = true;
  formError.value = null;
  try {
    const path = { eventId: props.eventId, packageId: props.mission.id };
    const withAudience = await updatePackageAudience(path, props.mission.version, audience.value);
    const saved = await updateMissionWriters(path, withAudience.version, writersSelected.value ? writers.value : EMPTY);
    open.value = false;
    emit("saved", saved);
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    formError.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="600" scrollable>
    <v-card>
      <v-card-title class="text-title-large font-weight-medium text-wrap pt-5 px-6 pb-1">Access to {{ mission.name }}</v-card-title>
      <div class="text-body-medium text-medium-emphasis px-6">The map editor keeps its own permissions; this only concerns TAK apps.</div>
      <v-card-text class="px-6 pt-4">
        <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>

        <section class="access-section mb-3">
          <div class="text-title-small font-weight-medium">Who sees the mission</div>
          <div class="text-body-small text-medium-emphasis mb-1">Members get it in their TAK app.</div>
          <v-radio-group v-model="audience.allMembers" hide-details density="compact">
            <v-radio :value="true" label="Every member of the event" />
            <v-radio :value="false" label="Selected groups, roles and members" />
          </v-radio-group>
          <v-expand-transition>
            <div v-if="!audience.allMembers" class="mt-3">
              <EventAudiencePicker
                v-model="audience"
                :groups="options.groups"
                :roles="options.roles"
                :members="memberOptions(options)"
                :errors="messagesFor(fields, 'audience.groupIds')"
              />
            </div>
          </v-expand-transition>
        </section>

        <section class="access-section">
          <div class="text-title-small font-weight-medium">Who may change it from a TAK app</div>
          <div class="text-body-small text-medium-emphasis mb-1">
            Their markers and changes go straight into the mission and appear in the editor.
          </div>
          <v-radio-group v-model="writersSelected" hide-details density="compact">
            <v-radio :value="false" label="Nobody, the mission is read-only in TAK apps" />
            <v-radio :value="true" label="Selected groups, roles and members" />
          </v-radio-group>
          <v-expand-transition>
            <div v-if="writersSelected" class="mt-3">
              <EventAudiencePicker
                v-model="writers"
                :groups="options.groups"
                :roles="options.roles"
                :members="memberOptions(options)"
                :errors="messagesFor(fields, 'writers.groupIds')"
              />
            </div>
          </v-expand-transition>
        </section>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.access-section {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
