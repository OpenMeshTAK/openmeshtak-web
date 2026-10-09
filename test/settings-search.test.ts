import { describe, expect, it } from "vitest";
import { groupResults, searchSettings, type SettingsSearchEntry, type SettingsSection } from "@/shared/settings/settings-search";

const sections: SettingsSection[] = [
  { id: "display", title: "Display and units", icon: "", group: "ATAK settings" },
  { id: "routes", title: "Routes and navigation", icon: "", group: "ATAK settings" },
];

const entries: SettingsSearchEntry[] = [
  { id: "a", sectionId: "display", sectionTitle: "Display and units", label: "Distance unit", key: "rab_rng_units_pref", options: ["Feet, miles", "Meters, kilometers"] },
  { id: "b", sectionId: "routes", sectionTitle: "Routes and navigation", label: "Reroute distance", description: "Distance before Bloodhound plans a new route", key: "bloodhound_reroute_distance_pref" },
  { id: "c", sectionId: "display", sectionTitle: "Display and units", label: "Show ETA", description: "On range and bearing labels", key: "rab_preference_show_eta", advanced: true },
  { id: "d", sectionId: "display", sectionTitle: "Display and units", label: "Coordinate format", key: "coord_display_pref", options: ["MGRS", "UTM"] },
];

describe("settings search", () => {
  it("finds a word in labels, descriptions, keys and options across sections", () => {
    expect(searchSettings(entries, "range").map(({ id }) => id)).toEqual(["c"]);
    expect(searchSettings(entries, "distance").map(({ id }) => id)).toEqual(["a", "b"]);
    expect(searchSettings(entries, "kilometers").map(({ id }) => id)).toEqual(["a"]);
    expect(searchSettings(entries, "coord display").map(({ id }) => id)).toEqual(["d"]);
  });

  it("puts label matches first and keeps advanced entries", () => {
    expect(searchSettings(entries, "route").map(({ id }) => id)).toEqual(["b"]);
    expect(searchSettings(entries, "eta").map(({ id }) => id)).toEqual(["c"]);
  });

  it("returns nothing for an empty query or no match", () => {
    expect(searchSettings(entries, "   ")).toEqual([]);
    expect(searchSettings(entries, "zzz")).toEqual([]);
  });

  it("groups results in menu order", () => {
    const grouped = groupResults(searchSettings(entries, "distance"), [...sections].reverse());
    expect(grouped.map(({ section }) => section.id)).toEqual(["routes", "display"]);
  });
});
