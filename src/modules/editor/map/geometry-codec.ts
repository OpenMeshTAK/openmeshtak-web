import GeoJSON from "ol/format/GeoJSON";
import Circle from "ol/geom/Circle";
import Polygon from "ol/geom/Polygon";
import type Geometry from "ol/geom/Geometry";
import { fromLonLat, getPointResolution, toLonLat } from "ol/proj";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";
import { constrainRectangle, ellipsePolygon } from "./shape-editing";

/** The map shows Web Mercator; the data package model stays in WGS84 (EPSG:4326). */
const format = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });

/**
 * A vertex counts as unmoved when it is within about a centimetre of an original vertex. The
 * projection round trip changes the last digits, so exact comparison would report every vertex
 * as edited.
 */
const UNMOVED_TOLERANCE_DEGREES = 1e-7;
const UNCHANGED_RADIUS_METRES = 0.01;

type Position = number[];

/**
 * Web Mercator stretches distances by latitude, so a circle radius in metres is converted with
 * the map's resolution at the circle centre instead of being used as map units.
 */
function metresPerMapUnit(center: number[]): number {
  return getPointResolution("EPSG:3857", 1, center, "m");
}

export function toMapGeometry(geometry: PackageGeometry): Geometry {
  if (geometry.type === "Ellipse") return ellipsePolygon(geometry);
  if (geometry.type === "Rectangle") return new Polygon([[...geometry.coordinates, geometry.coordinates[0] ?? []].map((p) => fromLonLat(p))]);
  if (geometry.type === "Route") return format.readGeometry({ type: "LineString", coordinates: geometry.coordinates });
  if (geometry.type === "Circle") {
    const center = fromLonLat(geometry.coordinates);
    return new Circle(center, geometry.radius / metresPerMapUnit(center));
  }
  return format.readGeometry(geometry);
}

function positionsOf(geometry: PackageGeometry): Position[] {
  switch (geometry.type) {
    case "Point":
    case "Circle":
    case "Ellipse":
      return [geometry.coordinates];
    case "LineString":
    case "Rectangle":
    case "Route":
      return geometry.coordinates;
    case "Polygon":
      return geometry.coordinates.flat();
  }
}

function findUnmoved(position: Position, originals: Position[]): Position | undefined {
  return originals.find(
    (original) =>
      Math.abs((original[0] ?? 0) - (position[0] ?? 0)) < UNMOVED_TOLERANCE_DEGREES &&
      Math.abs((original[1] ?? 0) - (position[1] ?? 0)) < UNMOVED_TOLERANCE_DEGREES,
  );
}

function fromMapCircle(
  circle: Circle,
  original: PackageGeometry | undefined,
  restore: (position: Position) => Position,
): PackageGeometry {
  const center = circle.getCenter();
  const radius = circle.getRadius() * metresPerMapUnit(center);
  const keepRadius = original?.type === "Circle" && Math.abs(original.radius - radius) < UNCHANGED_RADIUS_METRES;
  return {
    type: "Circle",
    coordinates: restore(toLonLat(center)),
    radius: keepRadius ? original.radius : Math.round(radius * 100) / 100,
  };
}

/**
 * Converts an edited map geometry back to data package geometry. Unmoved vertices keep their
 * exact original coordinates and altitude; new or moved vertices are 2D because their altitude is
 * unknown, and unknown altitude is never turned into zero, which would be a real height.
 */
export function fromMapGeometry(geometry: Geometry, original?: PackageGeometry): PackageGeometry {
  const originals = original === undefined ? [] : positionsOf(original);
  const restore = (position: Position): Position =>
    findUnmoved(position, originals) ?? [position[0] ?? 0, position[1] ?? 0];

  if (original?.type === "Ellipse") {
    const old = toMapGeometry(original).getExtent();
    const next = geometry.getExtent();
    const centre = fromLonLat(original.coordinates);
    const dx = (next[0] ?? 0) - (old[0] ?? 0);
    const dy = (next[1] ?? 0) - (old[1] ?? 0);
    return { ...original, coordinates: Math.abs(dx) + Math.abs(dy) < 0.01 ? original.coordinates : toLonLat([(centre[0] ?? 0) + dx, (centre[1] ?? 0) + dy]).slice(0, 2) };
  }
  if (original?.type === "Rectangle" && geometry instanceof Polygon) {
    const rectangle = constrainRectangle(geometry, original);
    geometry.setCoordinates(rectangle.getCoordinates());
    return { type: "Rectangle", coordinates: (rectangle.getCoordinates()[0]?.slice(0, 4) ?? []).map((p) => restore(toLonLat(p))) };
  }

  if (geometry instanceof Circle) {
    return fromMapCircle(geometry, original, restore);
  }
  const written = format.writeGeometryObject(geometry, { decimals: 9 }) as PackageGeometry;
  switch (written.type) {
    case "Point":
    case "Circle":
      return { type: "Point", coordinates: restore(written.coordinates) };
    case "LineString":
      return original?.type === "Route" ? { ...original, coordinates: written.coordinates.map(restore) } : { type: "LineString", coordinates: written.coordinates.map(restore) };
    case "Polygon":
      return { type: "Polygon", coordinates: written.coordinates.map((ring) => ring.map(restore)) };
    default:
      throw new Error("Unsupported map geometry.");
  }
}
