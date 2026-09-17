import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";

type Position = number[];

function positionsOf(geometry: PackageGeometry): Position[] {
  switch (geometry.type) {
    case "Point":
    case "Circle":
      return [geometry.coordinates];
    case "LineString":
      return geometry.coordinates;
    case "Polygon":
      return geometry.coordinates.flat();
  }
}

/** Centre of the bounding box; the point that lands under the cursor when pasting. */
export function anchorOf(geometry: PackageGeometry): Position {
  const positions = positionsOf(geometry);
  const longitudes = positions.map((position) => position[0] ?? 0);
  const latitudes = positions.map((position) => position[1] ?? 0);
  return [
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  ];
}

/**
 * Shifts a geometry so its anchor lands on `target`. Moved positions lose their altitude: the
 * original height no longer applies at the new place, and unknown altitude is never zero.
 * Small shapes are shifted in degrees, which keeps their form well enough for pasting.
 */
export function moveGeometry(geometry: PackageGeometry, target: Position): PackageGeometry {
  const anchor = anchorOf(geometry);
  const deltaLongitude = (target[0] ?? 0) - (anchor[0] ?? 0);
  const deltaLatitude = (target[1] ?? 0) - (anchor[1] ?? 0);
  const move = (position: Position): Position => [
    (position[0] ?? 0) + deltaLongitude,
    (position[1] ?? 0) + deltaLatitude,
  ];

  switch (geometry.type) {
    case "Point":
      return { type: "Point", coordinates: move(geometry.coordinates) };
    case "Circle":
      return { type: "Circle", coordinates: move(geometry.coordinates), radius: geometry.radius };
    case "LineString":
      return { type: "LineString", coordinates: geometry.coordinates.map(move) };
    case "Polygon":
      return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => ring.map(move)) };
  }
}
