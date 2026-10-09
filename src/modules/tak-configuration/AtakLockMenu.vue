<script setup lang="ts">
import { mdiCheck, mdiEyeOffOutline, mdiLockOpenCheckOutline, mdiLockOpenVariantOutline, mdiLockOutline } from "@mdi/js";
import { computed } from "vue";
import { RESTRICTION_MODES, type RestrictionMode } from "./tak-settings";

/**
 * The lock of one ATAK settings item for the whole event, as a small menu next to the value:
 * not locked (the event sends nothing), normal, greyed out or hidden.
 */
const props = defineProps<{ mode: RestrictionMode | null; label: string; disabled: boolean }>();
const emit = defineEmits<{ update: [mode: RestrictionMode | null] }>();

const ICONS: Record<RestrictionMode, string> = { normal: mdiLockOpenCheckOutline, disabled: mdiLockOutline, hidden: mdiEyeOffOutline };
const choices: Array<{ value: RestrictionMode | null; title: string }> = [{ value: null, title: "Not locked" }, ...RESTRICTION_MODES];
const current = computed(() => choices.find(({ value }) => value === props.mode)?.title ?? "Not locked");
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activator }">
      <v-btn
        v-bind="activator"
        :icon="mode === null ? mdiLockOpenVariantOutline : ICONS[mode]"
        :color="mode === 'disabled' || mode === 'hidden' ? 'warning' : undefined"
        :class="{ 'text-medium-emphasis': mode === null }"
        :disabled="disabled"
        variant="text"
        size="small"
        :aria-label="`Lock ${label} in ATAK: ${current}`"
        :title="`In ATAK: ${current}`"
      />
    </template>
    <v-list density="compact" :aria-label="`Lock ${label} in ATAK`">
      <v-list-item v-for="choice in choices" :key="choice.title" :title="choice.title" @click="emit('update', choice.value)">
        <template #append>
          <v-icon v-if="choice.value === mode" :icon="mdiCheck" size="small" />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
