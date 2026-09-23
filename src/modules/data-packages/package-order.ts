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

