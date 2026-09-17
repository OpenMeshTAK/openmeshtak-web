import type { FeatureLike } from "ol/Feature";
import CircleGeometry from "ol/geom/Circle";
import Polygon from "ol/geom/Polygon";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";

/** Above this many metres per pixel (roughly zoom 12) only the selected object is labelled. */
const LABEL_MAX_RESOLUTION = 30;

const dotCache = new Map<string, Circle>();

function withOpacity(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(opacity)})`;
}

/** A coloured dot with a white outline, like ATAK spot markers (`b-m-p-s-m`). */
function dot(color: string, selected: boolean): Circle {
  const key = `${color}:${String(selected)}`;
  let image = dotCache.get(key);
  if (image === undefined) {
    image = new Circle({
      radius: selected ? 9 : 7,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: "#FFFFFF", width: 2 }),
      // Markers are never hidden by decluttering; only overlapping labels are.
      declutterMode: "none",
    });
    dotCache.set(key, image);
  }
  return image;
}

function label(name: string, kind: string): Text {
  return new Text({
    text: name,
    font: "600 12px Roboto, Arial, sans-serif",
    fill: new Fill({ color: "#1A1A1A" }),
    stroke: new Stroke({ color: "rgba(255, 255, 255, 0.95)", width: 3 }),
    // Lines carry their name along the line; markers below the dot; areas and circles inside.
    placement: kind === "line" ? "line" : "point",
    textBaseline: kind === "point" ? "top" : "middle",
    offsetY: kind === "point" ? 10 : 0,
    // Small areas such as buildings are labelled too, even when the name is wider than the shape.
    overflow: true,
  });
}

/** Room for the within-layer priority below, so every layer sits completely above the previous. */
const LAYER_STEP = 2_000_000;

/**
 * Drawing priority: higher layers above lower ones (as in the layer list), and within a layer
 * markers on top, then smaller shapes above larger ones. The selection and decluttering follow
 * the same order, so a building inside an operation area keeps its name and can be clicked.
 */
function priority(feature: FeatureLike, kind: string): number {
  const layerBase = Number(feature.get("layerRank") ?? 0) * LAYER_STEP;
  return layerBase + withinLayerPriority(feature, kind);
}

function withinLayerPriority(feature: FeatureLike, kind: string): number {
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
    ...(kind === "point" ? { image: dot(style.color, selected) } : {}),
    ...(selected || resolution <= LABEL_MAX_RESOLUTION ? { text: label(name, kind) } : {}),
  });
  // A light halo under the selected shape keeps it visible on any base map.
  return selected && kind !== "point"
    ? [new Style({ stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: width + 4 }) }), main]
    : [main];
}
