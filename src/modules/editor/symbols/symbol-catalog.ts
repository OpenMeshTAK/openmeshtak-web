/**
 * A short, human-readable catalogue of common MIL-STD-2525 symbols for the marker picker. A CoT
 * type is `a-<affiliation>-<function>`, e.g. `a-f-G-U-C-I` for friendly infantry. Anything not
 * listed can still be entered as a raw CoT type.
 */

export interface Affiliation {
  code: string;
  label: string;
}

/** Every 2525B standard identity that CoT and the map can draw, in the order ATAK lists them. */
export const AFFILIATIONS: Affiliation[] = [
  { code: "f", label: "Friendly" },
  { code: "a", label: "Assumed friend" },
  { code: "n", label: "Neutral" },
  { code: "u", label: "Unknown" },
  { code: "p", label: "Pending" },
  { code: "s", label: "Suspect" },
  { code: "h", label: "Hostile" },
  { code: "j", label: "Joker" },
  { code: "k", label: "Faker" },
];

/** Plain markers without a military symbol; `null` is the coloured spot marker. */
export const POINT_MARKERS: Array<{ cotType: string | null; label: string }> = [
  { cotType: null, label: "Coloured dot" },
  { cotType: "b-m-p-w", label: "Waypoint" },
  { cotType: "b-m-p-c", label: "Checkpoint" },
];

export interface CatalogSymbol {
  /** Part after the affiliation, e.g. `G-U-C-I`. */
  functionPath: string;
  label: string;
  group: string;
  /** Extra search words. */
  keywords?: string;
}

export const SYMBOLS: CatalogSymbol[] = [
  { functionPath: "G-U-C", label: "Combat unit", group: "Ground units", keywords: "unit team" },
  { functionPath: "G-U-C-I", label: "Infantry", group: "Ground units", keywords: "soldier foot" },
  { functionPath: "G-U-C-I-L", label: "Light infantry", group: "Ground units", keywords: "soldier foot" },
  { functionPath: "G-U-C-I-M", label: "Motorized infantry", group: "Ground units", keywords: "truck" },
  { functionPath: "G-U-C-I-Z", label: "Mechanized infantry", group: "Ground units", keywords: "apc ifv" },
  { functionPath: "G-U-C-A", label: "Armor", group: "Ground units", keywords: "tank" },
  { functionPath: "G-U-C-A-A", label: "Anti-armor", group: "Ground units", keywords: "antitank atgm" },
  { functionPath: "G-U-C-F", label: "Artillery", group: "Ground units", keywords: "fires gun" },
  { functionPath: "G-U-C-F-M", label: "Mortar", group: "Ground units", keywords: "fires" },
  { functionPath: "G-U-C-F-R", label: "Rocket artillery", group: "Ground units", keywords: "fires mlrs" },
  { functionPath: "G-U-C-D", label: "Air defense", group: "Ground units", keywords: "aa sam" },
  { functionPath: "G-U-C-R", label: "Reconnaissance", group: "Ground units", keywords: "recon scout" },
  { functionPath: "G-U-C-E", label: "Engineer", group: "Ground units", keywords: "pioneer sapper" },
  { functionPath: "G-U-C-E-C", label: "Combat engineer", group: "Ground units", keywords: "pioneer sapper" },
  { functionPath: "G-U-C-V", label: "Aviation", group: "Ground units", keywords: "air" },
  { functionPath: "G-U-U-A", label: "CBRN defense", group: "Support", keywords: "nbc abc chemical" },
  { functionPath: "G-U-U-E", label: "Explosive ordnance disposal", group: "Support", keywords: "eod bomb" },
  { functionPath: "G-U-U-M", label: "Military police", group: "Support", keywords: "mp" },
  { functionPath: "G-U-U-S", label: "Signal", group: "Support", keywords: "radio comms" },
  { functionPath: "G-U-S-A", label: "Administration", group: "Support", keywords: "admin hq" },
  { functionPath: "G-U-S-M", label: "Medical", group: "Support", keywords: "sanitäter medic ambulance" },
  { functionPath: "G-U-S-M-T", label: "Medical treatment facility", group: "Support", keywords: "hospital aid station" },
  { functionPath: "G-U-S-S", label: "Supply", group: "Support", keywords: "logistics" },
  { functionPath: "G-U-S-X", label: "Maintenance", group: "Support", keywords: "repair" },
  { functionPath: "G-U-S-T", label: "Transportation", group: "Support", keywords: "truck" },
  { functionPath: "G-E-V", label: "Ground vehicle", group: "Equipment", keywords: "car truck" },
  { functionPath: "G-E-V-A-T", label: "Tank", group: "Equipment", keywords: "armor" },
  { functionPath: "G-E-V-C", label: "Civilian vehicle", group: "Equipment", keywords: "car" },
  { functionPath: "G-E-V-E", label: "Engineer vehicle", group: "Equipment", keywords: "bulldozer" },
  { functionPath: "G-E-W", label: "Weapon", group: "Equipment", keywords: "gun" },
  { functionPath: "G-I", label: "Installation", group: "Equipment", keywords: "building base camp" },
  { functionPath: "A-M-F", label: "Fixed-wing aircraft", group: "Air", keywords: "plane jet" },
  { functionPath: "A-M-H", label: "Helicopter", group: "Air", keywords: "rotary heli" },
  { functionPath: "A-M-F-Q", label: "Drone (UAV)", group: "Air", keywords: "uav uas unmanned" },
  { functionPath: "A-C-F", label: "Civilian aircraft", group: "Air", keywords: "plane" },
  { functionPath: "A-C-H", label: "Civilian helicopter", group: "Air", keywords: "rotary heli" },
  { functionPath: "S-C", label: "Surface vessel", group: "Sea", keywords: "ship boat" },
  { functionPath: "U", label: "Subsurface track", group: "Sea", keywords: "submarine" },
  { functionPath: "G", label: "Ground track", group: "Generic", keywords: "point contact" },
  { functionPath: "A", label: "Air track", group: "Generic", keywords: "contact" },
  { functionPath: "S", label: "Sea track", group: "Generic", keywords: "contact ship" },
];

export function cotTypeOf(affiliation: string, symbol: CatalogSymbol): string {
  return `a-${affiliation}-${symbol.functionPath}`;
}

/** Friendly name of a CoT type, e.g. "Friendly · Infantry" or "Waypoint", or `null` when it is not catalogued. */
export function describeCotType(cotType: string): string | null {
  const point = POINT_MARKERS.find((marker) => marker.cotType === cotType);
  if (point !== undefined) {
    return point.label;
  }
  const [atom, affiliationCode, ...rest] = cotType.split("-");
  const affiliation = AFFILIATIONS.find(({ code }) => code === affiliationCode);
  const symbol = SYMBOLS.find(({ functionPath }) => functionPath === rest.join("-"));
  if (atom !== "a" || affiliation === undefined || symbol === undefined) {
    return null;
  }
  return `${affiliation.label} · ${symbol.label}`;
}
