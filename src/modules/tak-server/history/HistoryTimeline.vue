<script setup lang="ts">
import { mdiPause, mdiPlay, mdiSkipNext, mdiSkipPrevious } from "@mdi/js";
import { computed, onBeforeUnmount, ref, watch } from "vue";

/**
 * Replay control: a slider over the loaded range, play/pause with a speed factor and how much of
 * each track is drawn behind the replay time.
 */
const props = defineProps<{ start: number; end: number }>();
const cursor = defineModel<number>("cursor", { required: true });
const trailMs = defineModel<number | null>("trailMs", { required: true });

const playing = ref(false);
const speed = ref(60);
const speeds = [1, 10, 60, 300, 1800].map((value) => ({ title: `${String(value)}×`, value }));
const trails = [
  { title: "Whole past", value: null },
  { title: "Last 10 min", value: 600_000 },
  { title: "Last hour", value: 3_600_000 },
];
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" });
const label = computed(() => timeFormat.format(new Date(cursor.value)));
/** Slider steps of one second keep dragging smooth over multi-day ranges. */
const step = computed(() => Math.max(1000, Math.round((props.end - props.start) / 2000)));

let frame = 0;
let lastTick = 0;

function tick(now: number): void {
  const elapsed = now - lastTick;
  lastTick = now;
  const next = cursor.value + elapsed * speed.value;
  if (next >= props.end) {
    cursor.value = props.end;
    playing.value = false;
    return;
  }
  cursor.value = next;
  frame = requestAnimationFrame(tick);
}

watch(playing, (isPlaying) => {
  cancelAnimationFrame(frame);
  if (isPlaying) {
    if (cursor.value >= props.end) cursor.value = props.start;
    lastTick = performance.now();
    frame = requestAnimationFrame(tick);
  }
});

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <div class="history-timeline d-flex align-center flex-wrap ga-2 px-3 py-2">
    <v-btn :icon="mdiSkipPrevious" variant="text" size="small" aria-label="Go to the start" @click="cursor = start" />
    <v-btn :icon="playing ? mdiPause : mdiPlay" variant="tonal" size="small" :aria-label="playing ? 'Pause replay' : 'Play replay'" @click="playing = !playing" />
    <v-btn :icon="mdiSkipNext" variant="text" size="small" aria-label="Go to the end" @click="cursor = end" />
    <v-slider
      v-model="cursor"
      :min="start"
      :max="end"
      :step="step"
      hide-details
      color="primary"
      class="history-slider"
      aria-label="Replay time"
      @start="playing = false"
    />
    <span class="text-body-medium history-time">{{ label }}</span>
    <v-select v-model="speed" :items="speeds" density="compact" hide-details max-width="100" aria-label="Replay speed" />
    <v-select v-model="trailMs" :items="trails" density="compact" hide-details max-width="150" aria-label="Track shown behind the replay time" />
  </div>
</template>

<style scoped>
.history-slider {
  flex: 1 1 240px;
  min-width: 200px;
}

.history-time {
  min-width: 150px;
  font-variant-numeric: tabular-nums;
}
</style>
