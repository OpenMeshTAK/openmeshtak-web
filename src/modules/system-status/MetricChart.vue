<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId } from "vue";

/**
 * A compact line chart of one measured value over time: the current value large, a smoothed
 * line with a soft fill, and a crosshair with tooltip on hover. One series per chart: values of
 * different scale get their own chart, never a second axis.
 */
const props = defineProps<{
  title: string;
  points: ReadonlyArray<{ time: string; value: number }>;
  format: (value: number) => string;
  /** Fixed top of the scale, e.g. 100 for percentages; otherwise the largest value rounded up. */
  max?: number | undefined;
  /** Shown after the current value, e.g. "of 4.0 GB". */
  suffix?: string | undefined;
}>();

const HEIGHT = 72;
const AXIS = 16;
const PAD_TOP = 4;

const gradientId = `metric-fill-${useId()}`;
const box = ref<HTMLElement | null>(null);
const width = ref(300);
const hover = ref<number | null>(null);
let observer: ResizeObserver | null = null;

const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

/** A round top for the scale: 1, 2 or 5 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((step) => step * power >= value) ?? 10) * power;
}

const top = computed(() => props.max ?? niceMax(Math.max(...props.points.map(({ value }) => value), 0)));
const plotHeight = HEIGHT - AXIS - PAD_TOP;
const baseline = PAD_TOP + plotHeight;

const span = computed(() => {
  const first = props.points[0];
  const last = props.points.at(-1);
  return first === undefined || last === undefined ? null : { start: Date.parse(first.time), end: Date.parse(last.time) };
});

function x(at: string): number {
  const range = span.value;
  if (range === null || range.end === range.start) return width.value;
  return ((Date.parse(at) - range.start) / (range.end - range.start)) * width.value;
}

function y(value: number): number {
  return baseline - (Math.min(Math.max(value, 0), top.value) / top.value) * plotHeight;
}

const coordinates = computed(() => props.points.map(({ time: at, value }) => ({ x: x(at), y: y(value) })));

/**
 * A monotone cubic curve (Fritsch–Carlson): smooth, but it never swings above a peak or below
 * zero between two samples, so the line does not invent values.
 */
const line = computed(() => {
  const p = coordinates.value;
  if (p.length < 2) return "";
  const slopes = p.slice(1).map((point, index) => (point.y - p[index]!.y) / (point.x - p[index]!.x || 1));
  const tangents = p.map((_, index) => {
    if (index === 0) return slopes[0]!;
    if (index === p.length - 1) return slopes[index - 1]!;
    const before = slopes[index - 1]!;
    const after = slopes[index]!;
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
  let path = `M${p[0]!.x.toFixed(1)},${p[0]!.y.toFixed(1)}`;
  for (let index = 1; index < p.length; index += 1) {
    const from = p[index - 1]!;
    const to = p[index]!;
    const third = (to.x - from.x) / 3;
    path += `C${(from.x + third).toFixed(1)},${(from.y + tangents[index - 1]! * third).toFixed(1)} ${(to.x - third).toFixed(1)},${(to.y - tangents[index]! * third).toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
  }
  return path;
});

const area = computed(() => {
  const p = coordinates.value;
  return line.value === "" ? "" : `${line.value}L${p.at(-1)!.x.toFixed(1)},${baseline}L${p[0]!.x.toFixed(1)},${baseline}Z`;
});

const current = computed(() => props.points.at(-1) ?? null);
const hovered = computed(() => (hover.value === null ? null : (props.points[hover.value] ?? null)));

function onMove(event: PointerEvent): void {
  const offset = event.clientX - (event.currentTarget as SVGSVGElement).getBoundingClientRect().left;
  let best: number | null = null;
  let distance = Infinity;
  coordinates.value.forEach((point, index) => {
    const gap = Math.abs(point.x - offset);
    if (gap < distance) {
      distance = gap;
      best = index;
    }
  });
  hover.value = best;
}

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry !== undefined) width.value = Math.max(1, entry.contentRect.width);
  });
  if (box.value !== null) observer.observe(box.value);
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div class="metric">
    <div class="text-body-small text-medium-emphasis">{{ title }}</div>
    <div class="d-flex align-baseline ga-1 mb-1">
      <span class="text-title-large">{{ current ? format(current.value) : "–" }}</span>
      <span v-if="suffix" class="text-body-small text-medium-emphasis">{{ suffix }}</span>
    </div>
    <div ref="box" class="metric__chart">
      <div v-if="points.length < 2" class="metric__empty text-body-small text-medium-emphasis">Collecting data…</div>
      <svg
        v-else
        :width="width"
        :height="HEIGHT"
        role="img"
        :aria-label="`${title} over time, now ${current ? format(current.value) : ''}`"
        @pointermove="onMove"
        @pointerleave="hover = null"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="metric__fill-top" />
            <stop offset="100%" class="metric__fill-bottom" />
          </linearGradient>
        </defs>
        <line class="metric__grid" x1="0" :x2="width" :y1="PAD_TOP" :y2="PAD_TOP" />
        <line class="metric__baseline" x1="0" :x2="width" :y1="baseline" :y2="baseline" />
        <text class="metric__axis" x="2" :y="PAD_TOP + 11">{{ format(top) }}</text>
        <path :d="area" :fill="`url(#${gradientId})`" />
        <path :d="line" class="metric__line" />
        <text v-if="span" class="metric__axis" x="0" :y="HEIGHT - 3">{{ time.format(span.start) }}</text>
        <text v-if="span" class="metric__axis" :x="width" :y="HEIGHT - 3" text-anchor="end">{{ time.format(span.end) }}</text>
        <template v-if="hovered">
          <line class="metric__crosshair" :x1="x(hovered.time)" :x2="x(hovered.time)" :y1="PAD_TOP" :y2="baseline" />
          <circle class="metric__dot" :cx="x(hovered.time)" :cy="y(hovered.value)" r="4" />
        </template>
      </svg>
      <div v-if="hovered" class="metric__tooltip text-body-small" :style="{ left: `${Math.max(0, Math.min(x(hovered.time) + 8, width - 110))}px` }">
        <div class="text-medium-emphasis">{{ time.format(new Date(hovered.time)) }}</div>
        <div class="font-weight-medium">{{ format(hovered.value) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric__chart {
  position: relative;
  height: 72px;
}
.metric__empty {
  display: flex;
  align-items: center;
  height: 100%;
}
.metric__grid {
  stroke: rgba(var(--v-border-color), var(--v-border-opacity));
  stroke-dasharray: 3 4;
}
.metric__baseline {
  stroke: rgba(var(--v-border-color), var(--v-border-opacity));
}
.metric__axis {
  fill: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
  font-size: 10px;
}
.metric__fill-top {
  stop-color: rgb(var(--v-theme-primary));
  stop-opacity: 0.28;
}
.metric__fill-bottom {
  stop-color: rgb(var(--v-theme-primary));
  stop-opacity: 0;
}
.metric__line {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.metric__crosshair {
  stroke: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  stroke-dasharray: 2 3;
}
.metric__dot {
  fill: rgb(var(--v-theme-primary));
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 2;
}
.metric__tooltip {
  position: absolute;
  top: -4px;
  pointer-events: none;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-bright, var(--v-theme-surface)));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}
</style>
