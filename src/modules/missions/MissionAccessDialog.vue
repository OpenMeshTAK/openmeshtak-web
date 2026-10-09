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

const audience = ref<PackageAudience>(structuredClone(toRaw(props.mission.audience)));
const writers = ref<EventAudience>(structuredClone(toRaw(props.mission.writers)));
const saving = ref(false);
const formError = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (isOpen) {
    // The mission comes from reactive state and structuredClone cannot copy Vue proxies.
    audience.value = structuredClone(toRaw(props.mission.audience));
    writers.value = structuredClone(toRaw(props.mission.writers));
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
    const saved = await updateMissionWriters(path, withAudience.version, writers.value);
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
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card class="pa-2">
      <v-card-title>Access to {{ mission.name }}</v-card-title>
      <v-card-text>
        <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
        <div class="text-title-small mb-1">Who sees the mission</div>
        <v-radio-group v-model="audience.allMembers" hide-details class="mb-2">
          <v-radio :value="true" label="Every member of the event" />
          <v-radio :value="false" label="Selected groups, roles and members" />
        </v-radio-group>
        <v-expand-transition>
          <div v-if="!audience.allMembers" class="mt-2">
            <EventAudiencePicker
              v-model="audience"
              :groups="options.groups"
              :roles="options.roles"
              :members="memberOptions(options)"
              :errors="messagesFor(fields, 'audience.groupIds')"
            />
          </div>
        </v-expand-transition>
        <v-divider class="my-4" />
        <div class="text-title-small mb-1">Who may change it from a TAK app</div>
        <p class="text-body-medium text-medium-emphasis mt-0 mb-2">
          Their markers and changes go straight into the mission and appear in the editor. Nobody is selected by default.
        </p>
        <EventAudiencePicker
          v-model="writers"
          :groups="options.groups"
          :roles="options.roles"
          :members="memberOptions(options)"
          :errors="messagesFor(fields, 'writers.groupIds')"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
