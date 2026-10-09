<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";

/**
 * One setting in a settings card: its name and a short explanation on the left, the control on
 * the right, stacked on narrow screens. `settingId` is the anchor the settings search jumps to.
 */
defineProps<{
  title: string;
  description?: string | undefined;
  settingId?: string | undefined;
  /** Background for the (?) next to the title; the `hint` slot takes richer content. */
  hint?: string | undefined;
  /** A caveat shown as an orange (!) next to the title. */
  warning?: string | undefined;
  /** Always visible below the text, never hidden in a hint. */
  error?: string | undefined;
}>();
</script>

<template>
  <div class="settings-row" :data-setting-id="settingId">
    <div class="settings-row__text">
      <div class="d-flex align-center ga-1">
        <span class="text-body-large">{{ title }}</span>
        <InfoHint v-if="hint || $slots.hint" :label="`About ${title}`" :text="hint ?? ''">
          <slot name="hint">{{ hint }}</slot>
        </InfoHint>
        <InfoHint v-if="warning" tone="warning" :label="`Caution: ${title}`" :text="warning" />
        <slot name="title-append" />
      </div>
      <div v-if="description || $slots.description" class="text-body-small text-medium-emphasis">
        <slot name="description">{{ description }}</slot>
      </div>
      <div v-if="error" class="text-body-small text-error mt-1">{{ error }}</div>
    </div>
    <div class="settings-row__control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 8px 12px 16px;
}
.settings-row__text {
  flex: 1 1 auto;
  min-width: 0;
}
.settings-row__control {
  flex: 0 0 360px;
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
@media (max-width: 959px) {
  .settings-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .settings-row__control {
    flex-basis: auto;
    justify-content: flex-start;
  }
}
</style>
