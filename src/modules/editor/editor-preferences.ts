/**
 * Per-browser editor conveniences. Storage may be unavailable (private windows, blocked site
 * data), so every access is guarded and the editor works without it.
 */
import { DEFAULT_GRID_SETTINGS, GRID_SPACINGS, type GridSettings } from "./map/mgrs-grid";

const LAYERS_OPEN_KEY = "openmeshtak.editor.layersOpen";
const BASE_MAP_KEY = "openmeshtak.editor.baseMapId";

export function readBaseMapId(): string | null {
  try {
    return window.localStorage.getItem(BASE_MAP_KEY);
  } catch {
    return null;
  }
}

export function storeBaseMapId(id: string): void {
  try {
    window.localStorage.setItem(BASE_MAP_KEY, id);
  } catch {
    // Without storage the choice simply lasts for this page view.
  }
}

export function readLayersOpen(): boolean {
  try {
    return window.localStorage.getItem(LAYERS_OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

export function storeLayersOpen(open: boolean): void {
  try {
    window.localStorage.setItem(LAYERS_OPEN_KEY, String(open));
  } catch {
    // Without storage the choice simply lasts for this page view.
  }
}

const GRID_KEY = "openmeshtak.editor.mgrsGrid";

export function readGridVisible(): boolean {
  try {
    return window.localStorage.getItem(GRID_KEY) === "true";
  } catch {
    return false;
  }
}

export function storeGridVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(GRID_KEY, String(visible));
  } catch {
    // Without storage the choice simply lasts for this page view.
  }
}

const GRID_SETTINGS_KEY = "openmeshtak.editor.mgrsGridSettings";

export function readGridSettings(): GridSettings {
  try {
    const stored = JSON.parse(window.localStorage.getItem(GRID_SETTINGS_KEY) ?? "null") as Partial<GridSettings> | null;
    return {
      spacing: stored?.spacing === "auto" || GRID_SPACINGS.some((value) => value === stored?.spacing) ? stored!.spacing! : DEFAULT_GRID_SETTINGS.spacing,
      tone: stored?.tone === "light" ? "light" : "dark",
      width: stored?.width === "thin" || stored?.width === "thick" ? stored.width : "normal",
      labels: stored?.labels !== false,
    };
  } catch {
    return DEFAULT_GRID_SETTINGS;
  }
}

export function storeGridSettings(settings: GridSettings): void {
  try {
    window.localStorage.setItem(GRID_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Without storage the choice simply lasts for this page view.
  }
}
