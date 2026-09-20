<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import EventAudiencePicker from "@/modules/event-audience/EventAudiencePicker.vue";
import { audienceMembers, memberOptions, type AudienceOptions } from "@/modules/event-audience/audience-options";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { updatePackageAudience, type DataPackageDto, type PackageAudience } from "../data-packages.api";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ eventId: string; dataPackage: DataPackageDto; options: AudienceOptions }>();
const emit = defineEmits<{ saved: [dataPackage: DataPackageDto] }>();

const audience = ref<PackageAudience>(structuredClone(toRaw(props.dataPackage.audience)));
const saving = ref(false);
const formError = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (isOpen) {
    // The package comes from reactive state and structuredClone cannot copy Vue proxies.
    audience.value = structuredClone(toRaw(props.dataPackage.audience));
    formError.value = null;
    fields.value = {};
  }
});

const reach = computed(() => {
  const members = props.options.members;
  if (members === null) {
    return null;
  }
  return audience.value.allMembers ? members.length : audienceMembers(audience.value, members).length;
});

async function save(): Promise<void> {
  saving.value = true;
  formError.value = null;
  try {
    const saved = await updatePackageAudience(
      { eventId: props.eventId, packageId: props.dataPackage.id },
      props.dataPackage.version,
      audience.value,
    );
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
      <v-card-title>Who receives {{ dataPackage.name }}?</v-card-title>
      <v-card-text>
        <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
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
        <p v-if="reach !== null" class="text-body-2 text-medium-emphasis mb-0">
          Reaches {{ reach }} {{ reach === 1 ? "member" : "members" }}. Members download the newest
          published revision.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
