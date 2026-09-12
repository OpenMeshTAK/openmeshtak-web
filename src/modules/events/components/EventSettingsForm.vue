<script setup lang="ts">
import { computed, watch } from "vue";
import { messagesFor } from "@/shared/errors/field-errors";
import { suggestSlug } from "../slug";

export interface EventSettings {
  name: string;
  slug: string;
  timeZone: string;
  /** `datetime-local` value in the browser's local time, or empty. */
  startsAt: string;
  endsAt: string;
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
    hint="Lowercase letters, digits and single hyphens, e.g. lightsim-2027"
    persistent-hint
    :disabled="disabled"
    :error-messages="messagesFor(errors, 'slug')"
    class="mb-2"
  />
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
</template>
