// The ESM build only has a default export, although the typings also declare named ones.
import ms from "milsymbol";
import { Icon } from "ol/style";

/** CoT affiliation letter (second part of `a-f-G-…`) to the 2525 standard identity. */
const AFFILIATIONS: Record<string, string> = {
  f: "F", // friend
  a: "A", // assumed friend
  h: "H", // hostile
  s: "S", // suspect
  j: "J", // joker
  k: "K", // faker
  n: "N", // neutral
  u: "U", // unknown
  p: "P", // pending
};

/** CoT battle dimension (third part) letters match 2525B letter-based SIDCs. */
const DIMENSIONS = new Set(["P", "A", "G", "S", "U", "F"]);

/**
 * Converts a CoT atom type such as `a-f-G-U-C-I` into a 15-character 2525B SIDC such as
 * `SFGPUCI--------`, the same mapping TAK clients use. Non-atom types (spot markers, waypoints)
 * have no military symbol and return `null`.
 */
export function sidcForCotType(cotType: string): string | null {
  const [atom, affiliation = "", dimension = "", ...functionParts] = cotType.split("-");
  const identity = AFFILIATIONS[affiliation];
  if (atom !== "a" || identity === undefined || !DIMENSIONS.has(dimension)) {
    return null;
  }
  const functionId = functionParts.join("").toUpperCase().padEnd(6, "-").slice(0, 6);
  return `S${identity}${dimension}P${functionId}-----`;
}

const iconCache = new Map<string, Icon | null>();

/** Military symbol for a CoT type as a map icon, or `null` when it cannot be drawn. */
export function symbolIcon(cotType: string, selected: boolean): Icon | null {
  const key = `${cotType}:${String(selected)}`;
  if (iconCache.has(key)) {
    return iconCache.get(key) ?? null;
  }
  const sidc = sidcForCotType(cotType);
  let icon: Icon | null = null;
  if (sidc !== null) {
    const symbol = new ms.Symbol(sidc, { size: selected ? 30 : 24 });
    if (symbol.isValid() === true) {
      const canvas = symbol.asCanvas();
      const anchor = symbol.getAnchor();
      icon = new Icon({
        img: canvas,
        width: canvas.width,
        height: canvas.height,
        anchor: [anchor.x, anchor.y],
        anchorXUnits: "pixels",
        anchorYUnits: "pixels",
        declutterMode: "none",
      });
    }
  }
  iconCache.set(key, icon);
  return icon;
}

const previewCache = new Map<string, string | null>();

/** Data URL of a symbol for the inspector and the picker, or `null` when it is not drawable. */
export function symbolPreview(cotType: string, size = 28): string | null {
  const key = `${cotType}:${String(size)}`;
  if (!previewCache.has(key)) {
    const sidc = sidcForCotType(cotType);
    const symbol = sidc === null ? null : new ms.Symbol(sidc, { size });
    previewCache.set(key, symbol?.isValid() === true ? symbol.asCanvas().toDataURL() : null);
  }
  return previewCache.get(key) ?? null;
}
