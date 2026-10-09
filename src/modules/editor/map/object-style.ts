import Feature, { type FeatureLike } from "ol/Feature";
import CircleGeometry from "ol/geom/Circle";
import Polygon from "ol/geom/Polygon";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import { Circle, Fill, RegularShape, Stroke, Style, Text } from "ol/style";
import type ImageStyle from "ol/style/Image";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";
import { symbolIcon } from "./cot-symbol";
import { iconsetStandin } from "./iconset-standin";
import { uploadedIcon } from "./uploaded-icon";

/** Above this many metres per pixel (roughly zoom 12) only the selected object is labelled. */
const LABEL_MAX_RESOLUTION = 30;

const dotCache = new Map<string, ImageStyle>();

/** Own stand-ins for ATAK route points, which have no MIL-STD-2525 symbol: a triangle and a square. */
const ROUTE_POINT_SHAPES: Record<string, { points: number; angle: number }> = {
  "b-m-p-w": { points: 3, angle: 0 },
  "b-m-p-c": { points: 4, angle: Math.PI / 4 },
};

function withOpacity(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(opacity)})`;
}

/**
 * A coloured dot with a white outline, like ATAK spot markers (`b-m-p-s-m`), or the same as a
 * triangle for waypoints and a square for checkpoints.
 */
function dot(color: string, selected: boolean, cotType: string | null): ImageStyle {
  const shape = cotType === null ? undefined : ROUTE_POINT_SHAPES[cotType];
  const key = `${color}:${String(selected)}:${cotType ?? ""}`;
  let image = dotCache.get(key);
  if (image === undefined) {
    const radius = selected ? 9 : 7;
    const fill = new Fill({ color });
    const stroke = new Stroke({ color: "#FFFFFF", width: 2 });
    // Markers are never hidden by decluttering; only overlapping labels are.
    image =
      shape === undefined
        ? new Circle({ radius, fill, stroke, declutterMode: "none" })
        : new RegularShape({ points: shape.points, radius: radius + 2, angle: shape.angle, fill, stroke, declutterMode: "none" });
    dotCache.set(key, image);
  }
  return image;
}

function label(name: string, kind: string, belowSymbol: boolean): Text {
  return new Text({
    text: name,
    font: "600 12px Roboto, Arial, sans-serif",
    fill: new Fill({ color: "#1A1A1A" }),
    stroke: new Stroke({ color: "rgba(255, 255, 255, 0.95)", width: 3 }),
    // Lines carry their name along the line; markers below the dot; areas and circles inside.
    placement: kind === "line" || kind === "route" ? "line" : "point",
    textBaseline: kind === "point" ? "top" : "middle",
    offsetY: kind === "point" ? (belowSymbol ? 18 : 10) : 0,
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
export function objectPriority(feature: FeatureLike): number {
  const kind = String(feature.get("kind"));
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

const styleCache = new WeakMap<FeatureLike, { key: string; styles: Style[] }>();

/**
 * Style of one data package object; the name is shown when zoomed in or when selected.
 * OpenLayers asks for every style on every frame, so the result is kept per feature until the
 * feature changes (its revision), the selection, the label visibility or the uploaded icon state.
 */
export function objectStyle(feature: FeatureLike, resolution: number, selected: boolean): Style[] {
  const labelled = selected || resolution <= LABEL_MAX_RESOLUTION;
  const uploaded = feature.get("kind") === "point" ? uploadedIcon(feature, feature.get("iconImageUrl") as string | null, selected) : null;
  if (!(feature instanceof Feature)) {
    return buildObjectStyle(feature, labelled, selected, uploaded);
  }
  const key = `${String(feature.getRevision())}:${String(selected)}:${String(labelled)}:${String(uploaded !== null)}`;
  const cached = styleCache.get(feature);
  if (cached?.key === key) {
    return cached.styles;
  }
  const styles = buildObjectStyle(feature, labelled, selected, uploaded);
  styleCache.set(feature, { key, styles });
  return styles;
}

function buildObjectStyle(feature: FeatureLike, labelled: boolean, selected: boolean, uploaded: ImageStyle | null): Style[] {
  const style = feature.get("objectStyle") as PackageObjectStyle;
  const kind = String(feature.get("kind"));
  const name = String(feature.get("name") ?? "");
  const width = style.strokeWidth + (selected ? 2 : 0);
  // Military symbols for CoT atom types (a-*); spot markers and icon sets we cannot draw get a dot.
  const cotType = feature.get("cotType") as string | null;
  const iconsetPath = feature.get("iconsetPath") as string | null;
  const symbol = kind === "point" && cotType !== null && (iconsetPath == null || cotType !== "a-u-G") ? symbolIcon(cotType, selected) : null;
  const standIn = kind === "point" && iconsetPath != null ? iconsetStandin(iconsetPath, style.color, selected) : null;

  const main = new Style({
    zIndex: objectPriority(feature),
    stroke: new Stroke({ color: style.color, width, lineDash: style.strokeStyle === "dashed" ? [width * 3, width * 2] : undefined }),
    fill: new Fill({ color: withOpacity(style.fillColor ?? style.color, style.fillOpacity) }),
    ...(kind === "point" ? { image: uploaded ?? symbol ?? standIn ?? dot(style.color, selected, cotType) } : {}),
    ...(labelled ? { text: label(name, kind, uploaded !== null || symbol !== null) } : {}),
  });
  // A light halo under the selected shape keeps it visible on any base map.
  const styles = selected && kind !== "point"
    ? [new Style({ stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: width + 4 }) }), main]
    : [main];
  const geometry = feature.getGeometry();
  if (kind === "route" && geometry instanceof LineString && labelled) {
    const points = feature.get("routePoints") as Array<{ type: string; name: string }> | null;
    geometry.getCoordinates().forEach((position, index) => {
      const point = points?.[index];
      styles.push(new Style({ geometry: new Point(position), image: dot(style.color, selected, point?.type === "waypoint" ? "b-m-p-w" : "b-m-p-c"), zIndex: objectPriority(feature) + 1,
        ...(point?.type === "waypoint" && point.name !== "" ? { text: label(point.name, "point", false) } : {}),
      }));
    });
  }
  return styles;
}

/**
 * Marks an object another editor has selected: a dashed outline in their color and their name,
 * drawn above the object's own style so it stays visible on any base map.
 */
export function remoteSelectionStyle(feature: FeatureLike, editor: { color: string; name: string }): Style {
  const kind = String(feature.get("kind"));
  const style = feature.get("objectStyle") as PackageObjectStyle;
  return new Style({
    zIndex: objectPriority(feature) + 1,
    stroke: new Stroke({ color: editor.color, width: style.strokeWidth + 4, lineDash: [8, 6] }),
    ...(kind === "point"
      ? { image: new Circle({ radius: 14, stroke: new Stroke({ color: editor.color, width: 3, lineDash: [5, 4] }), declutterMode: "none" }) }
      : {}),
    text: new Text({
      text: editor.name,
      font: "600 11px Roboto, Arial, sans-serif",
      fill: new Fill({ color: "#FFFFFF" }),
      backgroundFill: new Fill({ color: editor.color }),
      padding: [2, 5, 2, 5],
      placement: "point",
      textBaseline: "bottom",
      offsetY: kind === "point" ? -18 : 0,
      overflow: true,
    }),
  });
}
