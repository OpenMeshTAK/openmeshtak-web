import { describe, expect, it } from "vitest";
import { activeFilterCount, DEFAULT_FILTER, groupContacts, NO_GROUP, type ContactRow } from "@/modules/tak-server/contacts/contact-list";

function row(key: string, group: string | null, ageMs: number | null, extra: Partial<ContactRow> = {}): ContactRow {
  return { key, label: key, group, color: null, ageMs, stale: ageMs !== null && ageMs > 60_000, device: true, details: [], searchText: "", ...extra };
}

const rows = [
  row("BRAVO-2", "Bravo", 5_000),
  row("ALPHA-10", "Alpha", 120_000),
  row("ALPHA-2", "Alpha", 1_000, { searchText: "Peter Platoon leader" }),
  row("ADMIN", null, null),
  row("ALPHA-2.1", "Alpha", 30_000, { device: false }),
];

describe("contact panel model", () => {
  it("groups by event group with names in natural order and people without a group last", () => {
    const groups = groupContacts(rows, DEFAULT_FILTER);
    expect(groups.map(({ name }) => name)).toEqual(["Alpha", "Bravo", NO_GROUP]);
    expect(groups[0]?.rows.map(({ key }) => key)).toEqual(["ALPHA-2", "ALPHA-2.1", "ALPHA-10"]);
  });

  it("searches the label and the extra search text", () => {
    expect(groupContacts(rows, { ...DEFAULT_FILTER, search: "bravo" }).flatMap(({ rows: found }) => found.map(({ key }) => key))).toEqual(["BRAVO-2"]);
    expect(groupContacts(rows, { ...DEFAULT_FILTER, search: "peter" }).flatMap(({ rows: found }) => found.map(({ key }) => key))).toEqual(["ALPHA-2"]);
  });

  it("filters by status and kind", () => {
    const keys = (filter: Partial<typeof DEFAULT_FILTER>) => groupContacts(rows, { ...DEFAULT_FILTER, ...filter }).flatMap(({ rows: found }) => found.map(({ key }) => key));
    expect(keys({ status: "stale" })).toEqual(["ALPHA-10"]);
    expect(keys({ status: "none" })).toEqual(["ADMIN"]);
    expect(keys({ kind: "markers" })).toEqual(["ALPHA-2.1"]);
  });

  it("sorts by age with contacts without a position last", () => {
    const silent = groupContacts([row("A", "G", 5_000), row("B", "G", null), row("C", "G", 90_000)], { ...DEFAULT_FILTER, sort: "silent" });
    expect(silent[0]?.rows.map(({ key }) => key)).toEqual(["C", "A", "B"]);
    const recent = groupContacts([row("A", "G", 5_000), row("B", "G", null), row("C", "G", 90_000)], { ...DEFAULT_FILTER, sort: "recent" });
    expect(recent[0]?.rows.map(({ key }) => key)).toEqual(["A", "C", "B"]);
  });

  it("counts filter settings that differ from the default", () => {
    expect(activeFilterCount(DEFAULT_FILTER)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTER, search: "x" })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTER, status: "stale", sort: "silent" })).toBe(2);
  });
});
