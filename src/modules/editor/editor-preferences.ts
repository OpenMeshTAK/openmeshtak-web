/**
 * Per-browser editor conveniences. Storage may be unavailable (private windows, blocked site
 * data), so every access is guarded and the editor works without it.
 */
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
