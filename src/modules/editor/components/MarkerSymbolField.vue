<script setup lang="ts">
import { mdiChevronDown, mdiCircle, mdiClose } from "@mdi/js";
import { computed, ref, watch } from "vue";
import type { TakMarker } from "@/modules/data-packages/data-packages.api";
import { sidcForCotType, symbolPreview } from "../map/cot-symbol";
import { describeCotType } from "../symbols/symbol-catalog";
import SymbolPicker from "../symbols/SymbolPicker.vue";

const props = defineProps<{ tak: TakMarker | null; color: string; disabled: boolean }>();
const emit = defineEmits<{ change: [tak: TakMarker | null] }>();

const COT_TYPE = /^[a-z](-[A-Za-z0-9]+){1,15}$/;

const pickerOpen = ref(false);
const typed = ref("");
watch(
  () => props.tak,
  (tak) => {
    typed.value = tak?.cotType ?? "";
  },
  { immediate: true },
);

const preview = computed(() => (props.tak === null ? null : symbolPreview(props.tak.cotType)));
const label = computed(() => {
  if (props.tak === null || props.tak.cotType === "b-m-p-s-m") {
    return "Spot marker";
  }
  return describeCotType(props.tak.cotType) ?? props.tak.cotType;
});
const typeError = computed(() =>
  typed.value === "" || COT_TYPE.test(typed.value) ? [] : ["Use a CoT type such as a-f-G-U-C-I."],
);

/** Keeps a stored icon set path when only the type changes. */
function apply(cotType: string | null): void {
  pickerOpen.value = false;
  const trimmed = cotType?.trim() ?? "";
  if (trimmed === (props.tak?.cotType ?? "") || (trimmed !== "" && !COT_TYPE.test(trimmed))) {
    return;
  }
  emit("change", trimmed === "" ? null : { cotType: trimmed, iconsetPath: props.tak?.iconsetPath ?? null });
}

function removeIconset(): void {
  if (props.tak !== null) {
    emit("change", { cotType: props.tak.cotType, iconsetPath: null });
  }
}
</script>

<template>
  <div class="mb-3">
    <div class="text-caption text-medium-emphasis mb-1">Symbol</div>
    <v-menu v-model="pickerOpen" :close-on-content-click="false" location="start top" :disabled="disabled">
      <template #activator="{ props: menu }">
        <v-btn v-bind="menu" variant="outlined" block class="justify-start symbol-button" :disabled="disabled">
          <img v-if="preview" :src="preview" alt="" class="symbol-preview mr-3">
          <v-icon v-else :icon="mdiCircle" :color="color" class="mr-3" />
          <span class="flex-grow-1 text-left text-truncate text-none">{{ label }}</span>
          <v-icon :icon="mdiChevronDown" size="small" />
        </v-btn>
      </template>
      <SymbolPicker :cot-type="tak?.cotType ?? null" @select="apply" />
    </v-menu>

    <v-expansion-panels variant="accordion" flat class="mt-2">
      <v-expansion-panel title="Advanced" class="advanced-panel">
        <v-expansion-panel-text>
          <v-text-field
            v-model="typed"
            label="CoT type"
            placeholder="b-m-p-s-m"
            hint="Any ATAK CoT type; a-* types are drawn as MIL-STD-2525 symbols"
            persistent-hint
            density="compact"
            maxlength="64"
            :error-messages="typeError"
            :disabled="disabled"
            @blur="apply(typed)"
            @keydown.enter="apply(typed)"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-alert v-if="tak?.iconsetPath" type="info" variant="tonal" density="compact" class="mt-2 text-caption">
      <div class="d-flex align-center ga-1">
        <div class="flex-grow-1 text-break">
          ATAK icon <code>{{ tak.iconsetPath }}</code> is kept for ATAK.
          <template v-if="!sidcForCotType(tak.cotType)">The editor shows a plain marker.</template>
        </div>
        <v-btn v-if="!disabled" :icon="mdiClose" size="x-small" variant="text" aria-label="Remove ATAK icon" @click="removeIconset" />
      </div>
    </v-alert>
  </div>
</template>

<style scoped>
.symbol-button {
  height: 44px;
}
/* Let the label take the free space so the chevron sits at the right edge. */
.symbol-button :deep(.v-btn__content) {
  width: 100%;
}
.symbol-preview {
  height: 28px;
  width: auto;
}
.advanced-panel :deep(.v-expansion-panel-title) {
  min-height: 36px;
  padding: 4px 8px;
  font-size: 0.8125rem;
}
</style>
