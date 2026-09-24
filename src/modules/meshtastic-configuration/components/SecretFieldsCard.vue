<script setup lang="ts">
import { mdiCheckCircle, mdiEye, mdiEyeOff, mdiKeyVariant } from "@mdi/js";
import { ref } from "vue";
import { fieldErrors } from "@/shared/errors/field-errors";
import { useToast } from "@/shared/feedback/toast";
import { saveSecrets, type FirmwareFieldDto, type MeshtasticConfigurationDto } from "../meshtastic-configuration.api";

/**
 * Write-only settings such as the Wi-Fi password. Core never returns their values, so the card
 * only shows whether a value is set. Each change is saved on its own, separate from the settings
 * draft, and the typed value is dropped right after saving.
 */
const props = defineProps<{
  eventId: string;
  fields: FirmwareFieldDto[];
  configuration: MeshtasticConfigurationDto;
  editable: boolean;
}>();
const emit = defineEmits<{ changed: [configuration: MeshtasticConfigurationDto] }>();
const toast = useToast();

const editing = ref<string | null>(null);
const value = ref("");
const reveal = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

function isSet(field: FirmwareFieldDto): boolean {
  return props.configuration.secretsSet.includes(field.key);
}

function startEditing(field: FirmwareFieldDto): void {
  editing.value = field.key;
  value.value = "";
  reveal.value = false;
  error.value = null;
}

function cancel(): void {
  editing.value = null;
  value.value = "";
}

async function store(field: FirmwareFieldDto, secret: string | number | null): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const saved = await saveSecrets(props.eventId, props.configuration.version, { [field.key]: secret });
    cancel();
    emit("changed", saved);
    toast.success(secret === null ? `${field.label} removed.` : `${field.label} saved.`);
  } catch (caught: unknown) {
    error.value = fieldErrors(caught)[`secrets.${field.key}`] ?? null;
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

function submit(field: FirmwareFieldDto): void {
  void store(field, field.type === "integer" ? Number(value.value) : value.value);
}

function hintFor(field: FirmwareFieldDto): string {
  if (field.type === "integer") {
    return `${String(field.min)} to ${String(field.max)}`;
  }
  return field.maxBytes === undefined ? "" : `At most ${String(field.maxBytes)} bytes`;
}
</script>

<template>
  <v-card class="mb-4">
    <v-list lines="two" class="py-0">
      <template v-for="(field, index) in fields" :key="field.key">
        <v-divider v-if="index > 0" />
        <v-list-item :prepend-icon="mdiKeyVariant">
          <v-list-item-title>{{ field.label }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ field.description ?? "Write-only. Only goes into members' own settings files." }}
          </v-list-item-subtitle>

          <form v-if="editing === field.key" class="d-flex align-start ga-2 mt-3" @submit.prevent="submit(field)">
            <!-- A real form field so password managers can offer the value; never prefilled. -->
            <v-text-field
              v-model="value"
              :type="reveal ? 'text' : 'password'"
              :inputmode="field.type === 'integer' ? 'numeric' : undefined"
              :label="field.label"
              :hint="hintFor(field)"
              :error-messages="error ?? []"
              :append-inner-icon="reveal ? mdiEyeOff : mdiEye"
              autocomplete="new-password"
              density="compact"
              autofocus
              @click:append-inner="reveal = !reveal"
            />
            <v-btn variant="text" :disabled="saving" @click="cancel">Cancel</v-btn>
            <v-btn type="submit" color="primary" :loading="saving" :disabled="value === ''">Save</v-btn>
          </form>

          <template v-if="editing !== field.key" #append>
            <v-chip v-if="isSet(field)" size="small" color="success" variant="tonal" :prepend-icon="mdiCheckCircle" class="mr-2">
              Set
            </v-chip>
            <v-chip v-else size="small" variant="tonal" class="mr-2">Not set</v-chip>
            <template v-if="editable">
              <v-btn variant="text" size="small" @click="startEditing(field)">{{ isSet(field) ? "Change" : "Set" }}</v-btn>
              <v-btn v-if="isSet(field)" variant="text" size="small" color="error" :loading="saving" @click="store(field, null)">
                Remove
              </v-btn>
            </template>
          </template>
        </v-list-item>
      </template>
    </v-list>
  </v-card>
</template>
