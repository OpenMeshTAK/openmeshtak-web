<script setup lang="ts">
import { computed, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { messagesFor } from "@/shared/errors/field-errors";
import { suggestSlug } from "../slug";

export interface EventSettings {
  name: string;
  slug: string;
  timeZone: string;
  /** `datetime-local` value in the browser's local time, or empty. */
  startsAt: string;
  endsAt: string;
  /** Days an ATAK QR login stays valid; 0 means until the event ends. */
  takLoginTokenDays: number;
  /** Accounts created for this event stay after it is archived. */
  permanentAccounts: boolean;
}

const props = defineProps<{ errors: Record<string, string>; disabled?: boolean; autoSlug?: boolean }>();
const settings = defineModel<EventSettings>({ required: true });

// Offer the browser's IANA list as suggestions; Core decides what is valid.
const timeZones = computed(() => [...Intl.supportedValuesOf("timeZone"), "UTC"].sort());

watch(
  () => settings.value.name,
  (name) => {
    if (props.autoSlug === true) {
      settings.value.slug = suggestSlug(name);
    }
  },
);
</script>

<template>
  <v-text-field v-model="settings.name" label="Name" :disabled="disabled" :error-messages="messagesFor(errors, 'name')" />
  <v-text-field
    v-model="settings.slug"
    label="Slug"
    :disabled="disabled"
    :error-messages="messagesFor(errors, 'slug')"
    class="mb-2"
  >
    <template #append-inner>
      <InfoHint label="About slug" text="Lowercase letters, digits and single hyphens, e.g. lightsim-2027" />
    </template>
  </v-text-field>
  <v-autocomplete
    v-model="settings.timeZone"
    :items="timeZones"
    label="Time zone"
    variant="outlined"
    density="comfortable"
    :disabled="disabled"
    :error-messages="messagesFor(errors, 'timeZone')"
  />
  <div class="d-flex flex-wrap ga-4">
    <v-text-field
      v-model="settings.startsAt"
      type="datetime-local"
      label="Starts (your local time)"
      :disabled="disabled"
      :error-messages="messagesFor(errors, 'startsAt')"
      style="min-width: 220px"
    />
    <v-text-field
      v-model="settings.endsAt"
      type="datetime-local"
      label="Ends (your local time)"
      :disabled="disabled"
      :error-messages="messagesFor(errors, 'endsAt')"
      style="min-width: 220px"
    />
  </div>
  <v-text-field
    v-model.number="settings.takLoginTokenDays"
    type="number"
    min="0"
    max="3650"
    label="ATAK QR login valid for (days)"
    :disabled="disabled"
    :error-messages="messagesFor(errors, 'takLoginTokenDays')"
  >
    <template #append-inner>
      <InfoHint label="About the QR login lifetime">
        <p class="mb-2">How many days a participant's ATAK login QR code keeps working after it is created.</p>
        <p class="mb-2">
          Enter <strong>0</strong> to keep it working until the event's end date. If the event has no end date, it
          then never expires.
        </p>
        <p>Either way, the code stops working as soon as the participant no longer has TAK access.</p>
      </InfoHint>
    </template>
  </v-text-field>
</template>
