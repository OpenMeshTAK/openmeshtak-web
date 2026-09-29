<script setup lang="ts">
/**
 * One numbered step of the participant setup flow. The parent renders the steps inside an `<ol>`,
 * so assistive technology gets the order from the list; the visible number is decoration.
 */
defineProps<{ number: number; last?: boolean }>();
</script>

<template>
  <li class="setup-step" :class="{ 'setup-step--last': last }">
    <div class="setup-step__marker" aria-hidden="true">
      <span class="setup-step__number">{{ number }}</span>
    </div>
    <div class="setup-step__content">
      <slot />
    </div>
  </li>
</template>

<style scoped>
.setup-step {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 16px;
}

.setup-step__marker {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* The connector line runs from this step's number to the next one. */
.setup-step__marker::after {
  content: "";
  flex: 1;
  width: 2px;
  margin-top: 6px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
}

.setup-step--last .setup-step__marker::after {
  display: none;
}

.setup-step__number {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  font-weight: 600;
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}

.setup-step__content {
  min-width: 0;
  padding-bottom: 16px;
}

.setup-step--last .setup-step__content {
  padding-bottom: 0;
}

@media (max-width: 599px) {
  .setup-step {
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 10px;
  }

  .setup-step__number {
    width: 24px;
    height: 24px;
    font-size: 0.8125rem;
  }
}
</style>
