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
  return item.source === "mesh"
    ? new RegularShape({ points: 4, radius: 9, angle: Math.PI / 4, fill, stroke })
    : new Circle({ radius: 7, fill, stroke });
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
    }),
  });
}

function styleFor(item: LiveMapItem): Style[] {
  const heading = headingOf(item);
  const marker = new Style({
    image: markerFor(item),
    text:
      item.callsign === null
        ? undefined
        : new Text({
            text: item.callsign,
            offsetY: -16,
            font: "600 12px Roboto, sans-serif",
            fill: new Fill({ color: "#ffffff" }),
            stroke: new Stroke({ color: "rgba(0, 0, 0, 0.75)", width: 3 }),
          }),
  });
  return heading === null ? [marker] : [arrowFor(colorOf(item), heading), marker];
}

/** A read-only layer on top of the package content, replaced wholesale on every refresh. */
export function createLiveLayer(): { layer: VectorLayer; update(items: readonly LiveMapItem[]): void; positionOf(uid: string): number[] | null } {
  const source = new VectorSource();
  const layer = new VectorLayer({ source, zIndex: 1000 });
  const positions = new Map<string, number[]>();
  return {
    layer,
    update(items) {
      source.clear();
      positions.clear();
      source.addFeatures(
        items.map((item) => {
          const coordinate = fromLonLat([item.lon, item.lat]);
          positions.set(item.uid, coordinate);
          const feature = new Feature({ geometry: new Point(coordinate) });
          feature.setStyle(styleFor(item));
          return feature;
        }),
      );
    },
    positionOf(uid) {
      return positions.get(uid) ?? null;
    },
  };
}
