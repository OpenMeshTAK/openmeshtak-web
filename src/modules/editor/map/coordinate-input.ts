import { forward, toPoint } from "mgrs";
import proj4 from "proj4";

export interface UtmPosition { zone: number; hemisphere: "N" | "S"; easting: number; northing: number }
const definition = (zone: number, hemisphere: "N" | "S") => `+proj=utm +zone=${zone} ${hemisphere === "S" ? "+south" : ""} +datum=WGS84 +units=m +no_defs`;
function validGridPosition(position: number[]): void {
  if (!position.every(Number.isFinite) || (position[0] ?? 181) < -180 || (position[0] ?? 181) > 180 || (position[1] ?? 91) < -80 || (position[1] ?? 91) > 84) throw new Error("UTM/MGRS input covers 80°S to 84°N. Use decimal degrees outside that range.");
}
export function toUtm(position: number[]): UtmPosition {
  validGridPosition(position);
  // The maintained MGRS converter chooses the standard Norway/Svalbard zone exceptions.
  const grid = forward([position[0]!, position[1]!], 5);
  const zone = Number(/^\d{1,2}/.exec(grid)?.[0]);
  const hemisphere = position[1]! < 0 ? "S" : "N";
  const projected = proj4("EPSG:4326", definition(zone, hemisphere), position.slice(0, 2));
  return { zone, hemisphere, easting: projected[0]!, northing: projected[1]! };
}
export function fromUtm(input: UtmPosition): number[] {
  if (!Number.isInteger(input.zone) || input.zone < 1 || input.zone > 60 || !["N", "S"].includes(input.hemisphere)
    || !Number.isFinite(input.easting) || input.easting < 100000 || input.easting > 900000
    || !Number.isFinite(input.northing) || input.northing < 0 || input.northing > 10000000) throw new Error("Enter zone 1–60, hemisphere N/S, easting 100000–900000 and northing 0–10000000 metres.");
  const position = proj4(definition(input.zone, input.hemisphere), "EPSG:4326", [input.easting, input.northing]);
  validGridPosition(position);
  return position;
}
export function toMgrs(position: number[]): string {
  validGridPosition(position);
  return forward([position[0]!, position[1]!], 5);
}
export function fromMgrs(text: string): { position: number[]; resolution: number } {
  const normalized = text.toUpperCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})[C-HJ-NP-X][A-HJ-NP-Z]{2}(\d{0,10})$/.exec(normalized);
  if (match === null || Number(match[1]) < 1 || Number(match[1]) > 60 || match[2]!.length % 2 !== 0) throw new Error("Enter a complete MGRS reference with a zone, band, grid square and an even number of digits (up to ten).");
  const position = toPoint(normalized);
  validGridPosition(position);
  // MGRS names a cell, not an exact point. Applying explicitly selects that cell's centre.
  return { position, resolution: 100000 / 10 ** (match[2]!.length / 2) };
}
