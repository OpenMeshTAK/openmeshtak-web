import { describe, expect, it } from "vitest";
import { applyTrafficChanges } from "@/modules/tak-server/live-traffic-changes";
import type { Schemas } from "@/shared/api/types";

type Item = Schemas["LiveTakItemDto"];

function item(uid: string, lat = 52): Item {
  return { uid, type: "a-f-G", callsign: uid, lat, lon: 11, course: null, speed: null, time: "2026-10-10T10:00:00.000Z", stale: "2026-10-10T10:02:00.000Z" };
}

describe("live traffic changes", () => {
  it("updates, adds and removes items without touching the previous snapshot", () => {
    const before = { connections: [], items: [item("A"), item("B")] };
    const after = applyTrafficChanges(before, { connections: { upserted: [], removed: [] }, items: { upserted: [item("A", 53), item("C")], removed: ["B"] } });
    expect(after.items.map(({ uid, lat }) => [uid, lat])).toEqual([["A", 53], ["C", 52]]);
    expect(before.items.map(({ uid }) => uid)).toEqual(["A", "B"]);
  });
});
