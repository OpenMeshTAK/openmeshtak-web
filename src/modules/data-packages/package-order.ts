/** Drag type for reordering whole data packages; lowercase because browsers lowercase it anyway. */
export const PACKAGE_DRAG_TYPE = "application/x-openmeshtak-data-package";

interface Ordered {
  id: string;
  sortOrder: number;
  createdAt: string;
}

/** Top of the list is drawn on top of the map, like layers; ties fall back to the newest. */
export function topFirst<T extends Ordered>(packages: readonly T[]): T[] {
  return [...packages].sort(
    (a, b) => b.sortOrder - a.sortOrder || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

/**
 * Moves the dragged package to the position of the drop target in a top-first list and returns
 * the IDs bottom first, as Core expects them. `null` when nothing changes.
 */
export function reorderedBottomFirst(topFirstIds: readonly string[], draggedId: string, targetId: string): string[] | null {
  const from = topFirstIds.indexOf(draggedId);
  const to = topFirstIds.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) {
    return null;
  }
  const ids = [...topFirstIds];
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  return ids.reverse();
}
