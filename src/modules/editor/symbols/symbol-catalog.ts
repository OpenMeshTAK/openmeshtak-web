/**
 * A short, human-readable catalogue of common MIL-STD-2525 symbols for the marker picker. A CoT
 * type is `a-<affiliation>-<function>`, e.g. `a-f-G-U-C-I` for friendly infantry. Anything not
 * listed can still be entered as a raw CoT type.
 */

export interface Affiliation {
  code: string;
  label: string;
}

export const AFFILIATIONS: Affiliation[] = [
  { code: "f", label: "Friendly" },
  { code: "h", label: "Hostile" },
  { code: "n", label: "Neutral" },
  { code: "u", label: "Unknown" },
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
  { functionPath: "G-U-C-I-Z", label: "Mechanized infantry", group: "Ground units", keywords: "apc ifv" },
  { functionPath: "G-U-C-A", label: "Armor", group: "Ground units", keywords: "tank" },
  { functionPath: "G-U-C-F", label: "Artillery", group: "Ground units", keywords: "fires gun" },
  { functionPath: "G-U-C-D", label: "Air defense", group: "Ground units", keywords: "aa sam" },
  { functionPath: "G-U-C-R", label: "Reconnaissance", group: "Ground units", keywords: "recon scout" },
  { functionPath: "G-U-C-E", label: "Engineer", group: "Ground units", keywords: "pioneer sapper" },
  { functionPath: "G-U-C-V", label: "Aviation", group: "Ground units", keywords: "air" },
  { functionPath: "G-U-U-S", label: "Signal", group: "Support", keywords: "radio comms" },
  { functionPath: "G-U-U-M", label: "Military police", group: "Support", keywords: "mp" },
  { functionPath: "G-U-S-M", label: "Medical", group: "Support", keywords: "sanitäter medic ambulance" },
  { functionPath: "G-U-S-S", label: "Supply", group: "Support", keywords: "logistics" },
  { functionPath: "G-U-S-X", label: "Maintenance", group: "Support", keywords: "repair" },
  { functionPath: "G-U-S-T", label: "Transportation", group: "Support", keywords: "truck" },
  { functionPath: "G-E-V", label: "Ground vehicle", group: "Equipment", keywords: "car truck" },
  { functionPath: "G-E-W", label: "Weapon", group: "Equipment", keywords: "gun" },
  { functionPath: "G-I", label: "Installation", group: "Equipment", keywords: "building base camp" },
  { functionPath: "A-M-F", label: "Fixed-wing aircraft", group: "Air", keywords: "plane jet" },
  { functionPath: "A-M-H", label: "Helicopter", group: "Air", keywords: "rotary heli" },
  { functionPath: "A-M-F-Q", label: "Drone (UAV)", group: "Air", keywords: "uav uas unmanned" },
  { functionPath: "S-C", label: "Surface vessel", group: "Sea", keywords: "ship boat" },
  { functionPath: "G", label: "Ground track", group: "Generic", keywords: "point contact" },
  { functionPath: "A", label: "Air track", group: "Generic", keywords: "contact" },
];

export function cotTypeOf(affiliation: string, symbol: CatalogSymbol): string {
  return `a-${affiliation}-${symbol.functionPath}`;
}

/** Friendly name of a CoT type, e.g. "Friendly · Infantry", or `null` when it is not catalogued. */
export function describeCotType(cotType: string): string | null {
  const [atom, affiliationCode, ...rest] = cotType.split("-");
  const affiliation = AFFILIATIONS.find(({ code }) => code === affiliationCode);
  const symbol = SYMBOLS.find(({ functionPath }) => functionPath === rest.join("-"));
  if (atom !== "a" || affiliation === undefined || symbol === undefined) {
    return null;
  }
  return `${affiliation.label} · ${symbol.label}`;
}
