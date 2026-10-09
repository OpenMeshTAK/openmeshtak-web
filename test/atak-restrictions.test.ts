import { describe, expect, it } from "vitest";
import type { AtakPreferenceEntryDto } from "@/modules/tak-configuration/tak-configuration.api";
import { restrictedItemOf, restrictionMode, withRestriction, type PreferenceTarget } from "@/modules/tak-configuration/tak-settings";

const event: PreferenceTarget = { type: "event", id: null };
const group: PreferenceTarget = { type: "group", id: "bravo" };

function values(entries: AtakPreferenceEntryDto[]): string[] {
  return entries.map(({ target, key, value }) => `${target.type}:${key}=${value}`);
}

describe("ATAK settings locks", () => {
  it("writes both keys for every mode, so a narrower target always overrides the event", () => {
    let entries = withRestriction([], event, "locationCallsign", "hidden");
    entries = withRestriction(entries, group, "locationCallsign", "disabled");
    expect(values(entries)).toEqual([
      "event:disablePreferenceItem_locationCallsign=true",
      "event:hidePreferenceItem_locationCallsign=true",
      "group:disablePreferenceItem_locationCallsign=true",
      "group:hidePreferenceItem_locationCallsign=false",
    ]);
    expect(restrictionMode(entries, event, "locationCallsign")).toBe("hidden");
    expect(restrictionMode(entries, group, "locationCallsign")).toBe("disabled");

    entries = withRestriction(entries, event, "locationCallsign", "normal");
    expect(restrictionMode(entries, event, "locationCallsign")).toBe("normal");
    expect(values(entries).slice(0, 2)).toEqual([
      "event:disablePreferenceItem_locationCallsign=false",
      "event:hidePreferenceItem_locationCallsign=false",
    ]);
  });

  it("removes both keys when the lock is cleared and reads single keys", () => {
    const entries = withRestriction(withRestriction([], event, "serverConnections", "disabled"), event, "serverConnections", null);
    expect(entries).toEqual([]);
    expect(restrictionMode(entries, event, "serverConnections")).toBeNull();

    const onlyHide: AtakPreferenceEntryDto[] = [
      { target: event, preference: "com.atakmap.app_preferences", key: "hidePreferenceItem_serverConnections", type: "boolean", value: "true" },
    ];
    expect(restrictionMode(onlyHide, event, "serverConnections")).toBe("hidden");
    expect(restrictedItemOf(onlyHide[0]!)).toBe("serverConnections");
    expect(restrictedItemOf({ preference: "com.atakmap.app_preferences", key: "coord_display_pref" })).toBeNull();
    expect(restrictedItemOf({ preference: "plugin", key: "hidePreferenceItem_x" })).toBeNull();
  });
});
