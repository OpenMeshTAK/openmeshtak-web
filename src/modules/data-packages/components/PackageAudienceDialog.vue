<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import EventAudiencePicker from "@/modules/event-audience/EventAudiencePicker.vue";
import { audienceMembers, memberOptions, type AudienceOptions } from "@/modules/event-audience/audience-options";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import {
  updatePackageAudience,
  updatePackageTakDelivery,
  type DataPackageDto,
  type PackageAudience,
  type PackageTakDelivery,
} from "../data-packages.api";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ eventId: string; dataPackage: DataPackageDto; options: AudienceOptions }>();
const emit = defineEmits<{ saved: [dataPackage: DataPackageDto] }>();

const audience = ref<PackageAudience>(structuredClone(toRaw(props.dataPackage.audience)));
const takDelivery = ref<PackageTakDelivery>({ ...props.dataPackage.takDelivery });
const saving = ref(false);
const formError = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (isOpen) {
    // The package comes from reactive state and structuredClone cannot copy Vue proxies.
    audience.value = structuredClone(toRaw(props.dataPackage.audience));
    takDelivery.value = { ...props.dataPackage.takDelivery };
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
    const path = { eventId: props.eventId, packageId: props.dataPackage.id };
    let saved = await updatePackageAudience(path, props.dataPackage.version, audience.value);
    const { onEnrollment, onConnection } = props.dataPackage.takDelivery;
    if (takDelivery.value.onEnrollment !== onEnrollment || takDelivery.value.onConnection !== onConnection) {
      saved = await updatePackageTakDelivery(path, saved.version, takDelivery.value);
    }
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
        <p v-if="reach !== null" class="text-body-medium text-medium-emphasis my-0">
          Reaches {{ reach }} {{ reach === 1 ? "member" : "members" }}. Members download the newest
          published revision.
        </p>
        <v-divider class="my-4" />
        <div class="text-title-small mb-1">Install automatically on TAK apps</div>
        <p class="text-body-medium text-medium-emphasis mt-0 mb-1">
          For members connected to the built-in TAK server. Without either option they pick the
          package in their TAK app themselves.
        </p>
        <v-checkbox v-model="takDelivery.onEnrollment" label="When a member enrolls a TAK app" density="compact" hide-details />
        <v-checkbox v-model="takDelivery.onConnection" label="On every connection, when a new revision is published" density="compact" hide-details />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
