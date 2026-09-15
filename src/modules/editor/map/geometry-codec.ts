import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import type { MissionGeometry } from "@/modules/missions/missions.api";

/** The map shows Web Mercator; the mission model stays in WGS84 (EPSG:4326). */
const format = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });

/**
 * A vertex counts as unmoved when it is within about a centimetre of an original vertex. The
 * projection round trip changes the last digits, so exact comparison would report every vertex
 * as edited.
 */
const UNMOVED_TOLERANCE_DEGREES = 1e-7;

type Position = number[];

export function toMapGeometry(geometry: MissionGeometry): Geometry {
  return format.readGeometry(geometry);
}

function positionsOf(geometry: MissionGeometry): Position[] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "LineString":
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

/**
 * Converts an edited map geometry back to mission GeoJSON. Unmoved vertices keep their exact
 * original coordinates and altitude; new or moved vertices are 2D because their altitude is
 * unknown, and unknown altitude is never turned into zero (EDITOR.md).
 */
export function fromMapGeometry(geometry: Geometry, original?: MissionGeometry): MissionGeometry {
  const written = format.writeGeometryObject(geometry, { decimals: 9 }) as MissionGeometry;
  const originals = original === undefined ? [] : positionsOf(original);
  const restore = (position: Position): Position =>
    findUnmoved(position, originals) ?? [position[0] ?? 0, position[1] ?? 0];

  switch (written.type) {
    case "Point":
      return { type: "Point", coordinates: restore(written.coordinates) };
    case "LineString":
      return { type: "LineString", coordinates: written.coordinates.map(restore) };
    case "Polygon":
      return { type: "Polygon", coordinates: written.coordinates.map((ring) => ring.map(restore)) };
  }
}
