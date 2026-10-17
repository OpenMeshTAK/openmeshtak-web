/**
 * Page size and sort order of one data table, kept per browser so a list opens the way it was
 * left. Storage can be missing or full, e.g. in private windows; the table then keeps its defaults.
 */
export interface DataTablePreferences {
  itemsPerPage?: number;
  sortBy?: { key: string; order: "asc" | "desc" }[];
}

function storageKey(table: string): string {
  return `openmeshtak.table.${table}`;
}

export function loadTablePreferences(table: string): DataTablePreferences {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(table)) ?? "{}");
    if (typeof stored !== "object" || stored === null) {
      return {};
    }
    const { itemsPerPage, sortBy } = stored as Record<string, unknown>;
    const preferences: DataTablePreferences = {};
    if (typeof itemsPerPage === "number") {
      preferences.itemsPerPage = itemsPerPage;
    }
    if (Array.isArray(sortBy)) {
      preferences.sortBy = sortBy.filter(
        (entry): entry is { key: string; order: "asc" | "desc" } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).key === "string" &&
          ["asc", "desc"].includes((entry as Record<string, unknown>).order as string),
      );
    }
    return preferences;
  } catch {
    return {};
  }
}

export function saveTablePreferences(table: string, preferences: DataTablePreferences): void {
  try {
    window.localStorage.setItem(storageKey(table), JSON.stringify(preferences));
  } catch {
    // Not remembering the layout is harmless.
  }
}
