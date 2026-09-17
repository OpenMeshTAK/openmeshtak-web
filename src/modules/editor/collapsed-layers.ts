/**
 * Which layers a viewer collapsed, per data package. A per-browser convenience only: storage may
 * be unavailable (private windows, blocked site data), so every access is guarded and the panel
 * still works without it.
 */
function storageKey(packageId: string): string {
  return `openmeshtak.editor.collapsed.${packageId}`;
}

export function readCollapsedLayers(packageId: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(packageId)) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function storeCollapsedLayers(packageId: string, layerIds: Set<string>): void {
  try {
    window.localStorage.setItem(storageKey(packageId), JSON.stringify([...layerIds]));
  } catch {
    // Without storage the choice simply lasts for this page view.
  }
}
