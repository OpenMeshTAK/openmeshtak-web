import { describe, expect, it } from "vitest";
import { itemsByContact, newestItem, visibleItems } from "@/modules/tak-server/contacts/live-contacts";
import type { Schemas } from "@/shared/api/types";

type Connection = Schemas["LiveTakConnectionDto"];
type Item = Schemas["LiveTakItemDto"];

const bravo = { id: "00000000-0000-4000-8000-0000000000b0", name: "Bravo" };

function connection(id: string, userId: string): Connection {
  return { id, userId, userDisplayName: userId, eventGroup: bravo, eventRole: null, callsign: id, connectedAt: "2026-10-16T10:00:00.000Z", lastSeenAt: "2026-10-16T10:00:00.000Z" };
}

function item(uid: string, connectionId: string, userId: string, time = "2026-10-16T10:00:00.000Z"): Item {
  return {
    uid, type: "a-h-G", callsign: uid, lat: 52, lon: 11, course: null, speed: null, time, stale: "2026-10-16T10:05:00.000Z",
    placedBy: { connectionId, userId, userDisplayName: userId, eventGroup: bravo },
  };
}

describe("live contacts", () => {
  const connections = [connection("c-alpha", "alpha"), connection("c-beta-new", "beta")];
  const items = [
    item("ALPHA", "c-alpha", "alpha"),
    item("ALPHA-MARKER", "c-alpha", "alpha"),
    item("BETA-OLD-MARKER", "c-beta-old", "beta"),
    item("GAMMA-MARKER", "c-gamma", "gamma"),
  ];

  it("assigns items to the sending app, the user's current app after a reconnect, or a disconnected sender", () => {
    const byContact = itemsByContact(connections, items);
    expect([...byContact].map(([key, list]) => [key, list.map(({ uid }) => uid)])).toEqual([
      ["c-alpha", ["ALPHA", "ALPHA-MARKER"]],
      ["c-beta-new", ["BETA-OLD-MARKER"]],
      ["user:gamma", ["GAMMA-MARKER"]],
    ]);
  });

  it("hides markers together with their sender's row, also for disconnected senders", () => {
    const byContact = itemsByContact(connections, items);
    expect(visibleItems(byContact, new Set(["c-alpha", "user:gamma"])).map(({ uid }) => uid)).toEqual(["BETA-OLD-MARKER"]);
  });

  it("finds the newest item by its own time", () => {
    expect(newestItem([item("A", "c", "u", "2026-10-16T10:00:00.000Z"), item("B", "c", "u", "2026-10-16T10:01:00.000Z")])?.uid).toBe("B");
    expect(newestItem([])).toBeUndefined();
  });
});
