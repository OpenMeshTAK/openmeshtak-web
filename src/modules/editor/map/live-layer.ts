import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Icon, RegularShape, Stroke, Style, Text } from "ol/style";

/** A live CoT item or mesh node as the map needs it; the view converts its data into this shape. */
export interface LiveMapItem {
  uid: string;
  type: string;
  callsign: string | null;
  lat: number;
  lon: number;
  /** `mesh`: a Meshtastic node heard by the HQ radio, drawn as a square instead of a CoT dot. */
  source?: "tak" | "mesh";
  /** A last known position older than the staleness threshold. */
  outdated?: boolean;
  /** Direction of travel in degrees clockwise from true north, when the sender reports one. */
  course?: number | null;
  /** Ground speed in metres per second, when the sender reports one. */
  speed?: number | null;
}

/**
 * CoT types start with an atom and an affiliation (`a-f-…` friendly, `a-h-…` hostile, …); the
 * usual MIL-STD-2525 colours make the live picture readable at a glance. Non-atom items such as
 * drawings and points of interest are grey.
 */
function colorFor(type: string): string {
  const [atom, affiliation] = type.split("-");
  if (atom !== "a") {
    return "#78909c";
  }
  switch (affiliation) {
    case "f":
    case "a":
      return "#1e88e5";
    case "h":
    case "s":
      return "#e53935";
    case "n":
      return "#43a047";
    default:
      return "#fdd835";
  }
}

const MESH_COLOR = "#8e24aa";
const STALE_COLOR = "#9e9e9e";

/** Mesh observations are squares so they are never mistaken for TAK/CoT markers. */
function colorOf(item: LiveMapItem): string {
  return item.outdated === true ? STALE_COLOR : item.source === "mesh" ? MESH_COLOR : colorFor(item.type);
}

function markerFor(item: LiveMapItem): Circle | RegularShape {
  const color = colorOf(item);
  const fill = new Fill({ color });
  const stroke = new Stroke({ color: "#ffffff", width: 2, lineDash: item.outdated === true ? [3, 3] : undefined });
  // Markers are never hidden by decluttering; only overlapping labels are.
  return item.source === "mesh"
    ? new RegularShape({ points: 4, radius: 9, angle: Math.PI / 4, fill, stroke, declutterMode: "none" })
    : new Circle({ radius: 7, fill, stroke, declutterMode: "none" });
}

/**
 * Below walking pace a GPS course is mostly noise, and apps without a fix report 0°; the arrow
 * only shows where someone is actually going.
 */
const MOVING_SPEED_MS = 0.5;

/** The course to draw, or null for stationary, outdated or course-less items. */
export function headingOf(item: LiveMapItem): number | null {
  if (item.outdated === true || item.course === undefined || item.course === null) {
    return null;
  }
  return item.speed !== undefined && item.speed !== null && item.speed < MOVING_SPEED_MS ? null : item.course;
}

/** Courses are drawn in 5° steps, so the arrow styles can be shared between items and updates. */
const ARROW_STEP_DEGREES = 5;

/** A small arrowhead just outside the marker, drawn pointing north and rotated to the course. */
function arrowFor(color: string, course: number): Style {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    `<path d="M20 1 L27 11 L20 8.5 L13 11 Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return new Style({
    image: new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      rotation: (course * Math.PI) / 180,
      rotateWithView: true,
      declutterMode: "none",
    }),
  });
}

/**
 * When callsign labels are drawn: `auto` only once the map is zoomed in far enough that labels of
 * a few hundred contacts no longer cover each other, `always` at every zoom, `off` never. The
 * selected item always shows its label.
 */
export type LiveLabelMode = "auto" | "always" | "off";

/** `auto` draws labels from this zoom level on, roughly where a company area fills the screen. */
export const LABEL_MIN_ZOOM = 14;
/** Web Mercator resolution in metres per pixel at zoom 0 for 256-pixel tiles. */
const ZOOM_0_RESOLUTION = 156_543.033_928_041;

export function showsLabel(mode: LiveLabelMode, resolution: number, selected: boolean): boolean {
  if (selected) return true;
  if (mode === "auto") return resolution <= ZOOM_0_RESOLUTION / 2 ** LABEL_MIN_ZOOM;
  return mode === "always";
}

function labelFor(callsign: string, selected: boolean): Text {
  return new Text({
    text: callsign,
    offsetY: -16,
    font: "600 12px Roboto, sans-serif",
    fill: new Fill({ color: "#ffffff" }),
    stroke: new Stroke({ color: "rgba(0, 0, 0, 0.75)", width: 3 }),
    // The selected item's label is never hidden behind an overlapping one.
    declutterMode: selected ? "none" : "declutter",
  });
}

/** A ring around the selected item, readable on light and dark base maps. */
const selectionStyle = new Style({
  image: new Circle({
    radius: 12,
    stroke: new Stroke({ color: "rgba(0, 0, 0, 0.75)", width: 4 }),
    declutterMode: "none",
  }),
});
const selectionInnerStyle = new Style({
  image: new Circle({ radius: 12, stroke: new Stroke({ color: "#ffffff", width: 2 }), declutterMode: "none" }),
});

/**
 * Styles are cached, because every new style makes OpenLayers prepare the marker, decode the
 * arrow image and render the label again. With hundreds of contacts refreshing twice a second
 * that is what made the live map stutter.
 */
const markerStyles = new Map<string, Style>();
const arrowStyles = new Map<string, Style>();
const MAX_CACHED_STYLES = 5_000;

function cached(cache: Map<string, Style>, key: string, create: () => Style): Style {
  let style = cache.get(key);
  if (style === undefined) {
    if (cache.size >= MAX_CACHED_STYLES) cache.clear();
    style = create();
    cache.set(key, style);
  }
  return style;
}

/** A key that changes only when the drawing changes, so unchanged items keep their style. */
function styleKey(item: LiveMapItem): string {
  const heading = headingOf(item);
  const step = heading === null ? "" : String(Math.round(heading / ARROW_STEP_DEGREES) * ARROW_STEP_DEGREES % 360);
  return `${colorOf(item)}|${item.source ?? "tak"}|${String(item.outdated === true)}|${step}|${item.callsign ?? ""}`;
}

/** The marker with or without its label; `label` is `selected` when the selection forces it. */
function markerStyleFor(item: LiveMapItem, label: "none" | "normal" | "selected"): Style {
  const color = colorOf(item);
  const callsign = label === "none" ? null : item.callsign;
  const markerKey = `${color}|${item.source ?? "tak"}|${String(item.outdated === true)}|${label}|${callsign ?? ""}`;
  return cached(markerStyles, markerKey, () => new Style({ image: markerFor(item), text: callsign === null ? undefined : labelFor(callsign, label === "selected") }));
}

function styleFor(item: LiveMapItem, labelled: boolean, selected: boolean): Style[] {
  const marker = markerStyleFor(item, !labelled ? "none" : selected ? "selected" : "normal");
  const styles = selected ? [selectionStyle, selectionInnerStyle] : [];
  const heading = headingOf(item);
  if (heading !== null) {
    const color = colorOf(item);
    const step = Math.round(heading / ARROW_STEP_DEGREES) * ARROW_STEP_DEGREES % 360;
    styles.push(cached(arrowStyles, `${color}|${String(step)}`, () => arrowFor(color, step)));
  }
  styles.push(marker);
  return styles;
}

interface Drawn {
  feature: Feature<Point>;
  key: string;
}

export interface LiveLayer {
  layer: VectorLayer;
  update(items: readonly LiveMapItem[]): void;
  positionOf(uid: string): number[] | null;
  setLabels(mode: LiveLabelMode): void;
  select(uid: string | null): void;
}

/**
 * A read-only layer on top of the package content. Each refresh moves the existing features and
 * swaps styles only where something changed, instead of rebuilding the whole layer. Overlapping
 * labels are hidden; the markers themselves always stay visible.
 */
export function createLiveLayer(): LiveLayer {
  const source = new VectorSource();
  const layer = new VectorLayer({ source, zIndex: 1000, declutter: true });
  const drawn = new Map<string, Drawn>();
  let labels: LiveLabelMode = "always";
  let selectedUid: string | null = null;
  /** Labels depend on the zoom, so the style is resolved per render instead of fixed per item. */
  const styleOf = (item: LiveMapItem) => (_feature: unknown, resolution: number): Style[] => {
    const selected = item.uid === selectedUid;
    return styleFor(item, item.callsign !== null && showsLabel(labels, resolution, selected), selected);
  };
  return {
    layer,
    update(items) {
      const seen = new Set<string>();
      const added: Feature[] = [];
      for (const item of items) {
        seen.add(item.uid);
        const coordinate = fromLonLat([item.lon, item.lat]);
        const key = styleKey(item);
        const existing = drawn.get(item.uid);
        if (existing === undefined) {
          const feature = new Feature({ geometry: new Point(coordinate) });
          feature.set("liveUid", item.uid);
          feature.setStyle(styleOf(item));
          drawn.set(item.uid, { feature, key });
          added.push(feature);
          continue;
        }
        const geometry = existing.feature.getGeometry();
        const [x, y] = geometry?.getCoordinates() ?? [];
        if (x !== coordinate[0] || y !== coordinate[1]) geometry?.setCoordinates(coordinate);
        if (existing.key !== key) {
          existing.key = key;
          existing.feature.setStyle(styleOf(item));
        }
      }
      for (const [uid, entry] of drawn) {
        if (!seen.has(uid)) {
          source.removeFeature(entry.feature);
          drawn.delete(uid);
        }
      }
      if (added.length > 0) source.addFeatures(added);
    },
    positionOf(uid) {
      return drawn.get(uid)?.feature.getGeometry()?.getCoordinates() ?? null;
    },
    setLabels(mode) {
      if (mode === labels) return;
      labels = mode;
      layer.changed();
    },
    select(uid) {
      if (uid === selectedUid) return;
      const previous = selectedUid === null ? undefined : drawn.get(selectedUid);
      selectedUid = uid;
      previous?.feature.changed();
      if (uid !== null) drawn.get(uid)?.feature.changed();
    },
  };
}
