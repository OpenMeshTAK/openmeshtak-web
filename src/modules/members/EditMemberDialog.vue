<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { ref, watch } from "vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { messagesFor } from "@/shared/errors/field-errors";
import { useSubmission } from "@/shared/composables/useSubmission";
import { updateMember, type EventMemberDto } from "./members.api";

type Assignment = { id: string; name: string };

const props = defineProps<{ eventId: string; member: EventMemberDto | null; roles: Assignment[]; groups: Assignment[] }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [member: EventMemberDto] }>();

const form = ref({ eventRoleId: "", eventGroupId: "", callsignOverride: "" });

function describeMemberError(error: unknown): string {
  if (isApiProblem(error, "MEMBER_IDENTITY_CONFLICT")) {
    return "This callsign is already taken or too long, or the group has no free short name.";
  }
  if (isApiProblem(error, "VERSION_CONFLICT")) {
    return "This member was changed in the meantime. Close the dialog and try again.";
  }
  return describeError(error);
}

const saving = useSubmission(describeMemberError);

watch(open, (isOpen) => {
  if (isOpen && props.member !== null) {
    form.value = {
      eventRoleId: props.member.eventRole.id,
      eventGroupId: props.member.eventGroup.id,
      callsignOverride: props.member.callsignOverride ?? "",
    };
    saving.reset();
  }
});

async function save(): Promise<void> {
  const member = props.member;
  if (member === null) {
    return;
  }
  const result = await saving.run(() =>
    updateMember(props.eventId, member.id, {
      version: member.version,
      eventRoleId: form.value.eventRoleId,
      eventGroupId: form.value.eventGroupId,
      callsignOverride: form.value.callsignOverride.trim() || null,
    }),
  );
  if (result !== null) {
    open.value = false;
    emit("saved", result.value);
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="pa-2">
      <v-card-title>Edit {{ member?.callsign }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Members added by an integration get the role and group it reports on its next
          synchronization. A callsign override stays until you clear it.
        </p>
        <v-alert v-if="saving.error.value" type="error" class="mb-4">{{ saving.error.value }}</v-alert>
        <div class="d-flex flex-wrap ga-4">
          <v-select
            v-model="form.eventRoleId"
            :items="roles"
            item-title="name"
            item-value="id"
            label="Role"
            style="min-width: 200px"
            :error-messages="messagesFor(saving.fields.value, 'eventRoleId')"
          />
          <v-select
            v-model="form.eventGroupId"
            :items="groups"
            item-title="name"
            item-value="id"
            label="Group"
            style="min-width: 200px"
            :error-messages="messagesFor(saving.fields.value, 'eventGroupId')"
          />
        </div>
        <v-text-field
          v-model="form.callsignOverride"
          label="Callsign override (optional)"
          maxlength="39"
          :error-messages="messagesFor(saving.fields.value, 'callsignOverride')"
        >
          <template #append-inner>
            <InfoHint label="About callsign override" text="Leave empty to use the group's callsign format" />
          </template>
        </v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving.submitting.value" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
