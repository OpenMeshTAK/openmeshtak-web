<script setup lang="ts">
import { mdiClose } from "@mdi/js";
import { computed, ref, watch } from "vue";
import type { TakMarker } from "@/modules/data-packages/data-packages.api";
import { sidcForCotType, symbolPreview } from "../map/cot-symbol";

const props = defineProps<{ tak: TakMarker | null; disabled: boolean }>();
const emit = defineEmits<{ change: [tak: TakMarker | null] }>();

/** Common choices; any other CoT type can be typed in. Empty means a plain spot marker. */
const PRESETS = [
  { title: "Spot marker (colour)", value: "" },
  { title: "Friendly ground unit", value: "a-f-G-U-C" },
  { title: "Friendly infantry", value: "a-f-G-U-C-I" },
  { title: "Hostile ground unit", value: "a-h-G-U-C" },
  { title: "Neutral ground unit", value: "a-n-G-U-C" },
  { title: "Unknown ground unit", value: "a-u-G-U-C" },
];
const COT_TYPE = /^[a-z](-[A-Za-z0-9]+){1,15}$/;

const typed = ref("");
watch(
  () => props.tak,
  (tak) => {
    typed.value = tak?.cotType ?? "";
  },
  { immediate: true },
);

const preview = computed(() => (props.tak === null ? null : symbolPreview(props.tak.cotType)));
const typeError = computed(() =>
  typed.value === "" || COT_TYPE.test(typed.value) ? [] : ["Use a CoT type such as a-f-G-U-C-I."],
);

/** Keeps a stored icon set path unless the type changes to one we can draw ourselves. */
function apply(cotType: string): void {
  const trimmed = cotType.trim();
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
    <div class="d-flex align-center ga-2">
      <v-select
        :model-value="PRESETS.some(({ value }) => value === (tak?.cotType ?? '')) ? (tak?.cotType ?? '') : null"
        :items="PRESETS"
        label="Preset"
        placeholder="Custom CoT type"
        density="compact"
        hide-details
        :disabled="disabled"
        @update:model-value="apply($event ?? '')"
      />
      <img v-if="preview" :src="preview" alt="" class="symbol-preview">
    </div>
    <v-text-field
      v-model="typed"
      label="CoT type"
      placeholder="b-m-p-s-m"
      hint="a-* types are drawn as MIL-STD-2525 symbols in ATAK"
      persistent-hint
      density="compact"
      class="mt-2"
      maxlength="64"
      :error-messages="typeError"
      :disabled="disabled"
      @blur="apply(typed)"
      @keydown.enter="apply(typed)"
    />
    <v-alert v-if="tak?.iconsetPath" type="info" variant="tonal" density="compact" class="mt-2 text-caption">
      <div class="d-flex align-center ga-1">
        <div class="flex-grow-1 text-break">
          ATAK icon <code>{{ tak.iconsetPath }}</code> is kept for ATAK.
          <template v-if="!sidcForCotType(tak.cotType)">The editor shows a plain marker.</template>
        </div>
        <v-btn
          v-if="!disabled"
          :icon="mdiClose"
          size="x-small"
          variant="text"
          aria-label="Remove ATAK icon"
          @click="removeIconset"
        />
      </div>
    </v-alert>
  </div>
</template>

<style scoped>
.symbol-preview {
  height: 32px;
  width: auto;
}
</style>
