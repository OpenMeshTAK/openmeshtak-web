import { Icon } from "ol/style";

export type IconStandIn = { shape: "pin" | "square" | "flag" | "person" | "diamond"; text: string | null };

/** Paths are identifiers, never URLs. No installed WinTAK icon images are bundled or fetched. */
export function iconStandIn(path: string): IconStandIn | null {
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] === "COT_MAPPING_SPOTMAP") return null;
  const group = (parts[1] ?? "").toLowerCase();
  const file = (parts[2] ?? "").replace(/\.[^.]+$/, "");
  // Only a short alphanumeric label is drawn; filenames never become SVG markup.
  const identifier = /(?:^|[_-])([A-Za-z0-9]{1,3})$/.exec(file)?.[1] ?? (/^[A-Za-z0-9]{1,3}$/.test(file) ? file : null);
  if (group.includes("letter") || group.includes("num")) return { shape: group.startsWith("sqr") ? "square" : "pin", text: identifier };
  if (group.includes("flag")) return { shape: "flag", text: null };
  if (group.includes("people") || group.includes("hiking")) return { shape: "person", text: null };
  if (group.includes("shape") || group.includes("building")) return { shape: "square", text: null };
  if (group.includes("military") || group.includes("iron") || group.includes("esf")) return { shape: "diamond", text: null };
  return { shape: "pin", text: null };
}

const DRAWINGS = {
  pin: '<path d="M16 30C13 26 5 19 5 12a11 11 0 0 1 22 0c0 7-8 14-11 18Z"/>',
  square: '<rect x="4" y="4" width="24" height="24" rx="3"/>',
  diamond: '<path d="m16 2 14 14-14 14L2 16Z"/>',
  flag: '<path d="M7 30V3h20l-4 7 4 7H7"/>',
  person: '<circle cx="16" cy="7" r="5"/><path d="M8 29v-9a8 8 0 0 1 16 0v9Z"/>',
};
const icons = new Map<string, Icon>();

export function iconsetStandin(path: string, color: string, selected: boolean): Icon | null {
  const descriptor = iconStandIn(path);
  if (descriptor === null) return null;
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#1E88E5";
  const key = `${descriptor.shape}:${descriptor.text ?? ""}:${safeColor}:${selected}`;
  let icon = icons.get(key);
  if (icon === undefined) {
    const text = descriptor.text === null ? "" : `<text x="16" y="18" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">${descriptor.text}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="-2 -2 36 36"><g fill="${safeColor}" stroke="white" stroke-width="2">${DRAWINGS[descriptor.shape]}</g>${text}</svg>`;
    icon = new Icon({ src: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: selected ? 36 : 28, height: selected ? 36 : 28, anchor: [0.5, descriptor.shape === "pin" ? 1 : 0.5], declutterMode: "none" });
    icons.set(key, icon);
  }
  return icon;
}
