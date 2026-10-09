<script setup lang="ts">
import InfoHint from "@/shared/components/InfoHint.vue";
import { mdiChevronDown, mdiCircle, mdiClose, mdiPencilOutline, mdiSquareRounded, mdiTriangle } from "@mdi/js";
import { computed, ref, toRef, watch } from "vue";
import type { PackageContentDto, TakMarker } from "@/modules/data-packages/data-packages.api";
import { sidcForCotType, symbolPreview } from "../map/cot-symbol";
import { describeCotType } from "../symbols/symbol-catalog";
import SymbolPicker from "../symbols/SymbolPicker.vue";
import type { PackagePath } from "../icon-libraries.api";
import { useIconSets, type IconChoice } from "../useIconSets";

const props = withDefaults(
  defineProps<{ tak: TakMarker | null; color: string; disabled: boolean; path?: PackagePath | null; contents?: PackageContentDto[] }>(),
  { path: null, contents: () => [] },
);
const emit = defineEmits<{ change: [tak: TakMarker | null] }>();

const COT_TYPE = /^[a-z](-[A-Za-z0-9]+){1,15}$/;

const { icons } = useIconSets(toRef(props, "path"), toRef(props, "contents"));
const pickerOpen = ref(false);
const editingType = ref(false);
const typed = ref("");
watch(
  () => props.tak,
  (tak) => {
    typed.value = tak?.cotType ?? "";
  },
  { immediate: true },
);

const icon = computed(() => (props.tak?.iconsetPath ? icons.value.find(({ path }) => path === props.tak?.iconsetPath) : undefined));
const preview = computed(() => icon.value?.imageUrl ?? (props.tak === null ? null : symbolPreview(props.tak.cotType)));
/** The map draws waypoints as triangles and checkpoints as squares, everything else as a dot. */
const pointIcon = computed(() => (props.tak?.cotType === "b-m-p-w" ? mdiTriangle : props.tak?.cotType === "b-m-p-c" ? mdiSquareRounded : mdiCircle));
const label = computed(() => {
  if (icon.value !== undefined) {
    return icon.value.filename.replace(/\.[a-z0-9]+$/i, "");
  }
  if (props.tak === null || props.tak.cotType === "b-m-p-s-m") {
    return "Spot marker";
  }
  return describeCotType(props.tak.cotType) ?? props.tak.cotType;
});
const typeError = computed(() =>
  typed.value === "" || COT_TYPE.test(typed.value) ? [] : ["Use a CoT type such as a-f-G-U-C-I."],
);

/** A symbol picked from the catalogue replaces any icon set image. */
function pick(cotType: string | null): void {
  pickerOpen.value = false;
  emit("change", cotType === null ? null : { cotType, iconsetPath: null });
}

/** Icon set images keep the current CoT type unless the icon set defines its own. */
function pickIcon(choice: IconChoice): void {
  pickerOpen.value = false;
  emit("change", { cotType: choice.cotType ?? props.tak?.cotType ?? "a-u-G", iconsetPath: choice.path });
}

/** Typing only changes the type and keeps a stored icon set path, e.g. from an imported ATAK marker. */
function applyTyped(): void {
  const trimmed = typed.value.trim();
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
  <div>
    <v-menu v-model="pickerOpen" :close-on-content-click="false" location="start top" :disabled="disabled">
      <template #activator="{ props: menu }">
        <v-btn v-bind="menu" variant="outlined" block class="justify-start symbol-button" :disabled="disabled">
          <img v-if="preview" :src="preview" alt="" class="symbol-preview mr-3">
          <v-icon v-else :icon="pointIcon" :color="color" class="mr-3" />
          <span class="flex-grow-1 text-left text-truncate text-none">{{ label }}</span>
          <v-icon :icon="mdiChevronDown" size="small" />
        </v-btn>
      </template>
      <SymbolPicker
        :cot-type="tak?.cotType ?? null"
        :icons="icons"
        :iconset-path="tak?.iconsetPath ?? null"
        @select="pick"
        @select-icon="pickIcon"
      />
    </v-menu>

    <v-text-field
      v-if="editingType"
      v-model="typed"
      label="CoT type"
      placeholder="b-m-p-s-m"
      density="compact"
      maxlength="64"
      class="mt-3"
      autofocus
      :error-messages="typeError"
      :hide-details="typeError.length === 0"
      :disabled="disabled"
      @blur="applyTyped(), (editingType = typeError.length > 0)"
      @keydown.enter="applyTyped(), (editingType = typeError.length > 0)"
    >
      <template #append-inner>
        <InfoHint label="About the CoT type" text="Any ATAK CoT type; a-* types are drawn as MIL-STD-2525 symbols" />
      </template>
    </v-text-field>
    <div v-else class="d-flex align-center ga-1 mt-1 text-body-small text-medium-emphasis">
      <span>CoT type</span>
      <code class="text-truncate">{{ tak?.cotType ?? "b-m-p-s-m" }}</code>
      <v-btn
        v-if="!disabled"
        :icon="mdiPencilOutline"
        size="x-small"
        variant="text"
        density="comfortable"
        aria-label="Edit CoT type"
        @click="editingType = true"
      />
    </div>

    <v-alert v-if="tak?.iconsetPath && icon === undefined" type="info" variant="tonal" density="compact" class="mt-2 text-body-small">
      <div class="d-flex align-center ga-1">
        <div class="flex-grow-1 text-break">
          ATAK icon <code>{{ tak.iconsetPath }}</code> is kept for ATAK.
          <template v-if="!sidcForCotType(tak.cotType)">Upload the matching icon set to display its image. Otherwise the editor uses its own vector symbol.</template>
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
  width: 28px;
  object-fit: contain;
}
</style>
