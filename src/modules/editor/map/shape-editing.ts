import ellipse from "@turf/ellipse";
import Polygon from "ol/geom/Polygon";
import { fromLonLat, getPointResolution, toLonLat } from "ol/proj";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";

type EllipseGeometry = Extract<PackageGeometry, { type: "Ellipse" }>;

export function ellipsePolygon(geometry: EllipseGeometry): Polygon {
  const footprint = ellipse(geometry.coordinates, geometry.major, geometry.minor, { units: "meters", steps: 64, angle: geometry.rotation + 90 });
  return new Polygon(footprint.geometry.coordinates.map((ring) => ring.map((p) => fromLonLat(p))));
}

/** Applies the rectangle rule to a saved shape; see {@link constrainRectangleCorners}. */
export function constrainRectangle(polygon: Polygon, original: Extract<PackageGeometry, { type: "Rectangle" }>): Polygon {
  return constrainRectangleCorners(polygon, original.coordinates.map((p) => fromLonLat(p)));
}

/**
 * Keeps a rectangle rectangular against its previous corners (map coordinates): a dragged corner
 * moves the adjacent corners and keeps the opposite one; a dragged edge moves only across itself.
 * Three or four changed corners are a translation or an already constrained shape.
 */
export function constrainRectangleCorners(polygon: Polygon, old: number[][]): Polygon {
  const next = polygon.getCoordinates()[0]?.slice(0, 4) ?? old;
  const moved = next.map((p, i) => Math.hypot((p[0] ?? 0) - (old[i]?.[0] ?? 0), (p[1] ?? 0) - (old[i]?.[1] ?? 0)) > 0.02);
  const count = moved.filter(Boolean).length;
  // Whole-shape translation already preserves the rectangle.
  if (count === 0 || count >= 3) return polygon;
  if (count === 2 && (moved[0] && moved[1] || moved[1] && moved[2] || moved[2] && moved[3] || moved[3] && moved[0])) {
    // Dragging an edge moves both of its corners; keep only the movement across the edge.
    const first = moved[3] && moved[0] ? 3 : moved.indexOf(true);
    const second = (first + 1) % 4;
    const a = old[first] ?? [0, 0];
    const b = old[second] ?? [0, 0];
    const length = Math.hypot((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0)) || 1;
    const normal = [-((b[1] ?? 0) - (a[1] ?? 0)) / length, ((b[0] ?? 0) - (a[0] ?? 0)) / length];
    const shift = [((next[first]?.[0] ?? 0) - (a[0] ?? 0) + (next[second]?.[0] ?? 0) - (b[0] ?? 0)) / 2, ((next[first]?.[1] ?? 0) - (a[1] ?? 0) + (next[second]?.[1] ?? 0) - (b[1] ?? 0)) / 2];
    const across = (shift[0] ?? 0) * (normal[0] ?? 0) + (shift[1] ?? 0) * (normal[1] ?? 0);
    const result = old.map((p) => [...p]);
    result[first] = [(a[0] ?? 0) + (normal[0] ?? 0) * across, (a[1] ?? 0) + (normal[1] ?? 0) * across];
    result[second] = [(b[0] ?? 0) + (normal[0] ?? 0) * across, (b[1] ?? 0) + (normal[1] ?? 0) * across];
    return new Polygon([[...result, result[0] ?? []]]);
  }
  const index = moved.indexOf(true);
  const opposite = (index + 2) % 4;
  const a = (index + 1) % 4;
  const b = (index + 3) % 4;
  const anchor = old[opposite] ?? [0, 0];
  const delta = [(next[index]?.[0] ?? 0) - (anchor[0] ?? 0), (next[index]?.[1] ?? 0) - (anchor[1] ?? 0)];
  const project = (corner: number[]) => {
    const x = (corner[0] ?? 0) - (anchor[0] ?? 0);
    const y = (corner[1] ?? 0) - (anchor[1] ?? 0);
    const length = Math.hypot(x, y);
    const along = ((delta[0] ?? 0) * x + (delta[1] ?? 0) * y) / (length * length);
    return [(anchor[0] ?? 0) + x * along, (anchor[1] ?? 0) + y * along];
  };
  next[a] = project(old[a] ?? []);
  next[b] = project(old[b] ?? []);
  next[opposite] = anchor;
  next[index] = [(next[a]?.[0] ?? 0) + (next[b]?.[0] ?? 0) - (anchor[0] ?? 0), (next[a]?.[1] ?? 0) + (next[b]?.[1] ?? 0) - (anchor[1] ?? 0)];
  return new Polygon([[...next, next[0] ?? []]]);
}

export type EllipseHandle = "centre" | "major" | "minor" | "rotation";

export function ellipseHandles(geometry: EllipseGeometry): Array<{ handle: EllipseHandle; position: number[] }> {
  const centre = fromLonLat(geometry.coordinates);
  const scale = getPointResolution("EPSG:3857", 1, centre, "m");
  const direction = geometry.rotation * Math.PI / 180;
  const at = (distance: number, angle: number) => [(centre[0] ?? 0) + Math.sin(angle) * distance / scale, (centre[1] ?? 0) + Math.cos(angle) * distance / scale];
  return [
    { handle: "centre", position: centre },
    { handle: "major", position: at(geometry.major, direction) },
    { handle: "minor", position: at(geometry.minor, direction + Math.PI / 2) },
    { handle: "rotation", position: at(geometry.major * 1.3, direction) },
  ];
}

export function ellipseFromHandle(original: EllipseGeometry, handle: EllipseHandle, position: number[], snapRotation = false): EllipseGeometry {
  if (handle === "centre") return { ...original, coordinates: toLonLat(position).slice(0, 2) };
  const centre = fromLonLat(original.coordinates);
  const x = (position[0] ?? 0) - (centre[0] ?? 0);
  const y = (position[1] ?? 0) - (centre[1] ?? 0);
  const distance = Math.max(0.1, Math.min(100_000, Math.hypot(x, y) * getPointResolution("EPSG:3857", 1, centre, "m")));
  if (handle === "rotation") {
    const rotation = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
    return { ...original, rotation: snapRotation ? Math.round(rotation / 15) * 15 % 360 : rotation };
  }
  return handle === "major" ? { ...original, major: Math.max(original.minor, distance) } : { ...original, minor: Math.min(original.major, distance) };
}
