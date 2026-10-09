import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, RegularShape, Stroke, Style, Text } from "ol/style";

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
function markerFor(item: LiveMapItem): Circle | RegularShape {
  const color = item.outdated === true ? STALE_COLOR : item.source === "mesh" ? MESH_COLOR : colorFor(item.type);
  const fill = new Fill({ color });
  const stroke = new Stroke({ color: "#ffffff", width: 2, lineDash: item.outdated === true ? [3, 3] : undefined });
  return item.source === "mesh"
    ? new RegularShape({ points: 4, radius: 9, angle: Math.PI / 4, fill, stroke })
    : new Circle({ radius: 7, fill, stroke });
}

function styleFor(item: LiveMapItem): Style {
  return new Style({
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
