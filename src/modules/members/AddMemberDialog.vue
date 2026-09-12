<script setup lang="ts">
import { ref, watch } from "vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import { syncMember } from "./members.api";

const props = defineProps<{ eventId: string; roles: { slug: string; name: string }[]; groups: { slug: string; name: string }[] }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [outcome: "member" | "sync-issue"] }>();

const form = ref({ provider: "discord", externalId: "", username: "", eventRole: "", group: "" });
const saving = ref(false);
const error = ref<string | null>(null);
const fields = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (isOpen) {
    form.value = {
      provider: "discord",
      externalId: "",
      username: "",
      eventRole: props.roles[0]?.slug ?? "",
      group: props.groups[0]?.slug ?? "",
    };
    error.value = null;
    fields.value = {};
  }
});

/**
 * Uses the same idempotent upsert as integrations. Synchronizing never creates a password or
 * session; the participant later signs in with an access link.
 */
async function save(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const result = await syncMember(props.eventId, form.value.provider.trim(), form.value.externalId.trim(), {
      username: form.value.username,
      eventRole: form.value.eventRole,
      group: form.value.group,
    });
    open.value = false;
    emit("saved", result.outcome);
  } catch (caught: unknown) {
    fields.value = fieldErrors(caught);
    error.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="pa-2">
      <v-card-title>Add member</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Members are identified by their account in an external system, for example their Discord
          user ID. Adding the same identity again updates the existing member.
        </p>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <div class="d-flex flex-wrap ga-4">
          <v-text-field v-model="form.provider" label="System" hint="e.g. discord" persistent-hint style="min-width: 160px" />
          <v-text-field v-model="form.externalId" label="External ID" style="min-width: 220px" />
        </div>
        <v-text-field
          v-model="form.username"
          label="Name"
          hint="Used in the callsign, e.g. Peter"
          persistent-hint
          class="mb-2"
          :error-messages="messagesFor(fields, 'username')"
        />
        <div class="d-flex flex-wrap ga-4">
          <v-select v-model="form.eventRole" :items="roles" item-title="name" item-value="slug" label="Role" style="min-width: 200px" />
          <v-select v-model="form.group" :items="groups" item-title="name" item-value="slug" label="Group" style="min-width: 200px" />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">Add member</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
