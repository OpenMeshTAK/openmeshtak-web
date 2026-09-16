import { mdiMapMarker } from "@mdi/js";
import type { FeatureLike } from "ol/Feature";
import CircleGeometry from "ol/geom/Circle";
import Polygon from "ol/geom/Polygon";
import { Fill, Icon, Stroke, Style, Text } from "ol/style";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";

/** Above this many metres per pixel (roughly zoom 12) only the selected object is labelled. */
const LABEL_MAX_RESOLUTION = 30;
/** The tip of the MDI map-marker path sits at y=22 of its 24-unit view box. */
const PIN_TIP = 22 / 24;

const pinCache = new Map<string, Icon>();

function withOpacity(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(opacity)})`;
}

/** A map pin in the object's colour with a white outline, readable on any base map. */
function pin(color: string, selected: boolean): Icon {
  const key = `${color}:${String(selected)}`;
  let icon = pinCache.get(key);
  if (icon === undefined) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${mdiMapMarker}" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/></svg>`;
    icon = new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      anchor: [0.5, PIN_TIP],
      scale: selected ? 1.6 : 1.3,
      // Markers are never hidden by decluttering; only overlapping labels are.
      declutterMode: "none",
    });
    pinCache.set(key, icon);
  }
  return icon;
}

function label(name: string, kind: string): Text {
  return new Text({
    text: name,
    font: "600 12px Roboto, Arial, sans-serif",
    fill: new Fill({ color: "#1A1A1A" }),
    stroke: new Stroke({ color: "rgba(255, 255, 255, 0.95)", width: 3 }),
    // Lines carry their name along the line; markers below the pin; areas and circles inside.
    placement: kind === "line" ? "line" : "point",
    textBaseline: kind === "point" ? "top" : "middle",
    offsetY: kind === "point" ? 4 : 0,
    // Small areas such as buildings are labelled too, even when the name is wider than the shape.
    overflow: true,
  });
}

/**
 * Drawing priority: markers on top, then smaller shapes above larger ones. Decluttering keeps the
 * label drawn on top, so a building inside an operation area keeps its name.
 */
function priority(feature: FeatureLike, kind: string): number {
  if (kind === "point") {
    return 1_000_000;
  }
  const geometry = feature.getGeometry();
  const area = geometry instanceof Polygon ? geometry.getArea() : geometry instanceof CircleGeometry ? Math.PI * geometry.getRadius() ** 2 : 0;
  return Math.round(1_000_000 / (1 + Math.sqrt(area)));
}

/** Style of one data package object; the name is shown when zoomed in or when selected. */
export function objectStyle(feature: FeatureLike, resolution: number, selected: boolean): Style[] {
  const style = feature.get("objectStyle") as PackageObjectStyle;
  const kind = String(feature.get("kind"));
  const name = String(feature.get("name") ?? "");
  const width = style.strokeWidth + (selected ? 2 : 0);

  const main = new Style({
    zIndex: priority(feature, kind),
    stroke: new Stroke({ color: style.color, width }),
    fill: new Fill({ color: withOpacity(style.color, style.fillOpacity) }),
    ...(kind === "point" ? { image: pin(style.color, selected) } : {}),
    ...(selected || resolution <= LABEL_MAX_RESOLUTION ? { text: label(name, kind) } : {}),
  });
  // A light halo under the selected shape keeps it visible on any base map.
  return selected && kind !== "point"
    ? [new Style({ stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: width + 4 }) }), main]
    : [main];
}
