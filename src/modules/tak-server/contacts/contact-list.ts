/**
 * Read model of the contact panels in Live and History: one row per connected app or recorded
 * track, grouped by event group (platoon), searched, filtered and sorted. The panels only render
 * what this returns, so 200–300 contacts stay a matter of a few array passes.
 */

export interface ContactRow {
  /** Connection id in Live, track UID in History; also the key for show/hide. */
  key: string;
  label: string;
  /** Event group (platoon) name, or null for people outside the event's groups. */
  group: string | null;
  /** Track color in History; null where the map colors by affiliation instead. */
  color: string | null;
  /** How old the last known position is, or null without any position. */
  ageMs: number | null;
  /** The last position is older than the panel's threshold: not heard from for a while. */
  stale: boolean;
  /** The app's own position, as opposed to a marker someone placed. */
  device: boolean;
  /** Extra lines for the row menu, e.g. the person's name and counts. */
  details: string[];
  /** Text matched by the search besides the label. */
  searchText: string;
}

export type ContactStatus = "all" | "current" | "stale" | "none";
export type ContactKind = "all" | "devices" | "markers";
export type ContactSort = "name" | "recent" | "silent";

export interface ContactFilter {
  search: string;
  status: ContactStatus;
  kind: ContactKind;
  sort: ContactSort;
}

export interface ContactGroup {
  name: string;
  rows: ContactRow[];
}

export const NO_GROUP = "No group";

export const DEFAULT_FILTER: ContactFilter = { search: "", status: "all", kind: "all", sort: "name" };

function matchesStatus(row: ContactRow, status: ContactStatus): boolean {
  switch (status) {
    case "all":
      return true;
    case "current":
      return row.ageMs !== null && !row.stale;
    case "stale":
      return row.ageMs !== null && row.stale;
    case "none":
      return row.ageMs === null;
  }
}

function matchesKind(row: ContactRow, kind: ContactKind): boolean {
  return kind === "all" || (kind === "devices") === row.device;
}

/** Contacts without a position sort last when sorting by age, whichever direction. */
function compare(sort: ContactSort): (a: ContactRow, b: ContactRow) => number {
  const byName = (a: ContactRow, b: ContactRow): number => a.label.localeCompare(b.label, undefined, { numeric: true });
  if (sort === "name") return byName;
  const direction = sort === "recent" ? 1 : -1;
  return (a, b) => {
    if (a.ageMs === null || b.ageMs === null) return a.ageMs === b.ageMs ? byName(a, b) : a.ageMs === null ? 1 : -1;
    return (a.ageMs - b.ageMs) * direction || byName(a, b);
  };
}

/** The rows that pass the filter, in groups sorted by name with "No group" last. */
export function groupContacts(rows: readonly ContactRow[], filter: ContactFilter): ContactGroup[] {
  const term = filter.search.trim().toLowerCase();
  const groups = new Map<string, ContactRow[]>();
  for (const row of rows) {
    if (!matchesStatus(row, filter.status) || !matchesKind(row, filter.kind)) continue;
    if (term !== "" && !row.label.toLowerCase().includes(term) && !row.searchText.toLowerCase().includes(term)) continue;
    const name = row.group ?? NO_GROUP;
    const list = groups.get(name);
    if (list === undefined) groups.set(name, [row]);
    else list.push(row);
  }
  const order = compare(filter.sort);
  return [...groups]
    .sort(([a], [b]) => (a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b, undefined, { numeric: true })))
    .map(([name, list]) => ({ name, rows: list.sort(order) }));
}

/** How many filter settings differ from the default, for the badge on the filter button. */
export function activeFilterCount(filter: ContactFilter): number {
  return [filter.status !== "all", filter.kind !== "all", filter.sort !== "name"].filter(Boolean).length;
}
