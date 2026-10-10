import buffer from "@turf/buffer";
import sector from "@turf/sector";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import { toLonLat } from "ol/proj";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";

const format = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
const cache = new WeakMap<Geometry, { key: string; result: Geometry | null }>();

/** Recompute from live geometry while dragging, never from a stale saved footprint. */
export function planningMapFootprint(geometry: Geometry, style: PackageObjectStyle): Geometry | null {
  const key = `${geometry.getRevision()}:${JSON.stringify(style.sector ?? null)}:${style.corridorWidth ?? ""}`;
  const cached = cache.get(geometry);
  if (cached?.key === key) return cached.result;
  let result: Geometry | null = null;
  try { result = buildFootprint(geometry, style); }
  catch { /* A transient degenerate drag keeps the source visible; Core validates the save. */ }
  cache.set(geometry, { key, result });
  return result;
}

function buildFootprint(geometry: Geometry, style: PackageObjectStyle): Geometry | null {
  if (geometry instanceof Point && style.sector != null) {
    const { heading, sweep, radius } = style.sector;
    return format.readGeometry(sector(toLonLat(geometry.getCoordinates()), radius, heading - sweep / 2, heading + sweep / 2, { units: "meters", steps: 64 }).geometry);
  }
  if (geometry instanceof LineString && style.corridorWidth != null) {
    const result = buffer({ type: "LineString", coordinates: geometry.getCoordinates().map((p) => toLonLat(p).slice(0, 2)) }, style.corridorWidth / 2, { units: "meters", steps: 8 });
    return result === undefined ? null : format.readGeometry(result.geometry);
  }
  return null;
}
