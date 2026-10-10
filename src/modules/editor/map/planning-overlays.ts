import GeographicLib from "geographiclib-geodesic";
import type { FeatureLike } from "ol/Feature";
import Geometry from "ol/geom/Geometry";
import Circle from "ol/geom/Circle";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import GeoJSON from "ol/format/GeoJSON";
import buffer from "@turf/buffer";
import { fromLonLat, getPointResolution, toLonLat } from "ol/proj";
import { Fill, Stroke, Style, Text } from "ol/style";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";
import { distanceInUnit, formatBearing } from "./range-bearing";

const format = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
const cache = new WeakMap<FeatureLike, { geometry: Geometry; key: string; styles: Style[] }>();

/** Derived overlays use live map geometry, including during group translation. */
export function planningOverlayStyles(feature: FeatureLike, style: PackageObjectStyle, labelled: boolean, selected: boolean): Style[] {
  const geometry = feature.getGeometry();
  if (!(geometry instanceof Geometry)) return [];
  const key = `${geometry.getRevision()}:${JSON.stringify(style)}:${labelled}:${selected}`;
  const cached = cache.get(feature);
  if (cached?.geometry === geometry && cached.key === key) return cached.styles;
  const result: Style[] = [];
  const stroke = new Stroke({ color: style.color, width: style.strokeWidth + (selected ? 2 : 0) });
  const text = (label: string) => new Text({ text: label, fill: new Fill({ color: style.color }), stroke: new Stroke({ color: "#FFFFFF", width: 3 }), overflow: true });
  const direct = (center: number[], metres: number, bearing: number) => {
    const destination = GeographicLib.Geodesic.WGS84.Direct(center[1]!, center[0]!, bearing, metres);
    return fromLonLat([destination.lon2!, destination.lat2!]);
  };
  const arc = (center: number[], radius: number, start = 0, sweep = 360) => new LineString(Array.from({ length: 65 }, (_, index) => direct(center, radius, start + sweep * index / 64)));
  if (geometry instanceof Circle && (style.rangeCircle === true || style.bullseye != null)) {
    const center = toLonLat(geometry.getCenter());
    const radius = geometry.getRadius() * getPointResolution("EPSG:3857", 1, geometry.getCenter(), "m");
    const spacing = style.rangeCircle === true ? radius : style.bullseye!.ringDistance;
    const count = style.rangeCircle === true ? style.rangeRings ?? 1 : style.bullseye!.ringsVisible ? style.bullseye!.ringCount : 0;
    for (let index = 1; index <= count; index++) {
      result.push(new Style({ geometry: arc(center, spacing * index), stroke }));
      if (labelled) result.push(new Style({ geometry: new Point(direct(center, spacing * index, 90)), text: text(distanceInUnit(spacing * index, style.distanceUnit ?? "m")) }));
    }
    if (style.bullseye != null) for (let bearing = 0; bearing < 360; bearing += 30) {
      const edge = direct(center, radius, bearing);
      result.push(new Style({ geometry: new LineString([geometry.getCenter(), edge]), stroke }));
      if (labelled) result.push(new Style({ geometry: new Point(edge), text: text(`${formatBearing((bearing + (style.bullseye.edgeToCenter ? 180 : 0)) % 360, style.bearingUnit)} true`) }));
    }
  }
  if (geometry instanceof Point && style.sector != null && style.sector.visible !== false) {
    const sector = style.sector, center = toLonLat(geometry.getCoordinates());
    const spacing = sector.rangeLines ?? 100;
    // Bound range-line work without altering canonical spacing or stored data.
    const count = Math.min(200, Math.floor(sector.radius / spacing));
    for (let index = 1; index <= count; index++) result.push(new Style({ geometry: arc(center, spacing * index, sector.heading - sector.sweep / 2, sector.sweep), stroke }));
    if (sector.displayLabels === true) result.push(new Style({ geometry: new Point(direct(center, sector.radius, sector.heading)), text: text(`${distanceInUnit(sector.radius, style.distanceUnit ?? "m")} · ${formatBearing(sector.heading, style.bearingUnit)} true`) }));
  }
  if (style.minimumSafeDistance != null) {
    try {
      const source = geometry instanceof Circle ? format.writeGeometryObject(arc(toLonLat(geometry.getCenter()), geometry.getRadius() * getPointResolution("EPSG:3857", 1, geometry.getCenter(), "m"))) : format.writeGeometryObject(geometry);
      // Circles need an area footprint so the buffer surrounds the outer circumference.
      const input = source.type === "LineString" && geometry instanceof Circle ? { type: "Polygon" as const, coordinates: [source.coordinates] } : source;
      const boundary = buffer(input, style.minimumSafeDistance, { units: "meters", steps: 8 });
      if (boundary?.type === "Feature") result.push(new Style({ geometry: format.readGeometry(boundary.geometry), stroke: new Stroke({ color: style.msdColor ?? style.color, width: 3 }) }));
    } catch { /* Core rejects invalid derived boundaries; transient drags keep the source visible. */ }
  }
  cache.set(feature, { geometry, key, styles: result });
  return result;
}
