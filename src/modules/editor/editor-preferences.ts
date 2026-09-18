/**
 * Per-browser editor conveniences. Storage may be unavailable (private windows, blocked site
 * data), so every access is guarded and the editor works without it.
 */
const LAYERS_OPEN_KEY = "openmeshtak.editor.layersOpen";

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
