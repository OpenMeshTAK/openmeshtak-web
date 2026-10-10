import GeographicLib from "geographiclib-geodesic";
import type LineString from "ol/geom/LineString";
import { toLonLat } from "ol/proj";
import type { components } from "@/generated/api/schema";

export type DistanceUnit = components["schemas"]["DistanceUnit"];
export const DISTANCE_UNITS = ["m", "km", "ft", "mi", "nm"] as const;
const METRES_PER_UNIT: Record<DistanceUnit, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344, nm: 1852 };
export function distanceInUnit(metres: number, unit: DistanceUnit): string {
  return `${(metres / METRES_PER_UNIT[unit]).toFixed(unit === "m" || unit === "ft" ? 1 : 3)} ${unit}`;
}
export function trueBearing(coordinates: number[][]): number | null {
  const start = coordinates[0];
  const end = coordinates.at(-1);
  if (start === undefined || end === undefined || start[0] === end[0] && start[1] === end[1]) return null;
  return (GeographicLib.Geodesic.WGS84.Inverse(start[1]!, start[0]!, end[1]!, end[0]!).azi1! + 360) % 360;
}
export function formatBearing(degrees: number, unit: components["schemas"]["PackageObjectStyle"]["bearingUnit"] = "degrees"): string {
  if (unit === "mils") return `${(degrees * 6400 / 360).toFixed(1)} mils`;
  if (unit === "warsaw-mils") return `${(degrees * 6000 / 360).toFixed(1)} mils (RU)`;
  if (unit === "streck") return `${(degrees * 6300 / 360).toFixed(1)} streck`;
  if (unit === "radians") return `${(degrees * Math.PI / 180).toFixed(3)} rad`;
  if (unit === "clock") return `${(degrees / 30 || 12).toFixed(1)} o'clock`;
  return `${degrees.toFixed(1)}°`;
}
export function rangeBearingLabel(line: LineString, unit: DistanceUnit = "m", bearingUnit: components["schemas"]["PackageObjectStyle"]["bearingUnit"] = "degrees"): string {
  const coordinates = line.getCoordinates().map((point) => toLonLat(point));
  const heading = trueBearing(coordinates);
  const start = coordinates[0], end = coordinates.at(-1);
  const metres = start === undefined || end === undefined ? 0 : GeographicLib.Geodesic.WGS84.Inverse(start[1]!, start[0]!, end[1]!, end[0]!).s12!;
  return `${distanceInUnit(metres, unit)} · ${heading === null ? "—" : formatBearing(heading, bearingUnit)} true`;
}
