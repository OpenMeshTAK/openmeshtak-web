import { describe, expect, it } from "vitest";
import { itemsByContact, meshProvenance, newestItem, visibleItems } from "@/modules/tak-server/contacts/live-contacts";
import type { Schemas } from "@/shared/api/types";

type Connection = Schemas["LiveTakConnectionDto"];
type Item = Schemas["LiveTakItemDto"];

const bravo = { id: "00000000-0000-4000-8000-0000000000b0", name: "Bravo" };

function connection(id: string, userId: string): Connection {
  return { id, userId, userDisplayName: userId, eventGroup: bravo, eventRole: null, callsign: id, connectedAt: "2026-10-16T10:00:00.000Z", lastSeenAt: "2026-10-16T10:00:00.000Z" };
}

function item(uid: string, connectionId: string, userId: string, time = "2026-10-16T10:00:00.000Z"): Item {
  return {
    uid, type: "a-h-G", callsign: uid, lat: 52, lon: 11, course: null, speed: null, time, stale: "2026-10-16T10:05:00.000Z", source: "tak",
    placedBy: { connectionId, userId, userDisplayName: userId, eventGroup: bravo },
  };
}

const hq = { id: "00000000-0000-4000-8000-0000000000a1", name: "HQ North" };

function meshItem(uid: string, nodeId: string, userId: string | null): Item {
  return {
    uid, type: userId === null ? "a-u-G" : "a-f-G-U-C", callsign: uid, lat: 52, lon: 11, course: null, speed: null,
    time: "2026-10-16T10:00:00.000Z", stale: "2026-10-16T10:10:00.000Z", source: "mesh",
    placedBy: userId === null ? null : { connectionId: null, userId, userDisplayName: userId, eventGroup: bravo },
    mesh: {
      nodeNum: 1, nodeId, shortName: "B1", longName: uid, memberId: null, hq, receivedAt: "2026-10-16T10:00:00.000Z",
      batteryLevel: 101, snr: 6.5, rssi: -90, hopsAway: 0, channel: { index: 0, name: "Event" },
    },
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

  it("joins a bound node's mesh position to its member and lists unbound nodes apart", () => {
    const byContact = itemsByContact(connections, [meshItem("ALPHA", "!00000001", "alpha"), meshItem("DELTA", "!00000002", "delta"), meshItem("STRAY", "!00000003", null)]);
    expect([...byContact].map(([key, list]) => [key, list.map(({ uid }) => uid)])).toEqual([
      ["c-alpha", ["ALPHA"]],
      ["user:delta", ["DELTA"]],
      ["mesh:!00000003", ["STRAY"]],
    ]);
    expect(visibleItems(byContact, new Set(["mesh:!00000003"])).map(({ uid }) => uid)).toEqual(["ALPHA", "DELTA"]);
  });

  it("describes the node, HQ and signal of a mesh position", () => {
    const { mesh } = meshItem("STRAY", "!00000003", null);
    expect(mesh === undefined ? [] : meshProvenance(mesh)).toEqual(["Meshtastic !00000003 (B1)", "Heard by HQ North on channel Event", "Powered · SNR 6.5 dB · RSSI -90 dBm · Direct"]);
  });

  it("finds the newest item by its own time", () => {
    expect(newestItem([item("A", "c", "u", "2026-10-16T10:00:00.000Z"), item("B", "c", "u", "2026-10-16T10:01:00.000Z")])?.uid).toBe("B");
    expect(newestItem([])).toBeUndefined();
  });
});
