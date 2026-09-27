import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";

/** A live CoT item as the map needs it; the view converts API data into this shape. */
export interface LiveMapItem {
  uid: string;
  type: string;
  callsign: string | null;
  lat: number;
  lon: number;
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

function styleFor(item: LiveMapItem): Style {
  return new Style({
    image: new Circle({
      radius: 7,
      fill: new Fill({ color: colorFor(item.type) }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
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
