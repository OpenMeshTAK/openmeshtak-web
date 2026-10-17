import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNodeNumber } from "@/modules/mesh-bindings/node-number";
import { emptyMeshState, applyRadioEvent, type MeshNode } from "@/modules/offline/meshtastic/mesh-nodes";
import type { RadioEvent } from "@/modules/offline/meshtastic/radio-messages";
import { observationOf, type MeshObservation } from "@/modules/offline/uplink/mesh-observation";
import { MeshUplink, type SendOutcome, type UplinkStatus } from "@/modules/offline/uplink/mesh-uplink";
import { retryAfterMs } from "@/modules/offline/uplink/mesh-uplink.api";
import type { Outbox, OutboxEntry } from "@/modules/offline/uplink/uplink-outbox";

type PacketEvent = Extract<RadioEvent, { type: "packet" }>;

const receivedAt = new Date("2026-10-16T12:00:00.000Z");

function packet(patch: Partial<PacketEvent> = {}): PacketEvent {
  return {
    type: "packet",
    from: 0xa1b2c3d4,
    packetId: 0xfffffff0,
    channel: 1,
    encrypted: false,
    user: null,
    position: { lat: 52.1, lon: 11.6, altitude: null, time: 1_791_000_000, course: 90, speed: 1.5, precisionBits: 13 },
    batteryLevel: null,
    snr: 7.25,
    rssi: -95,
    hopsAway: 2,
    ...patch,
  };
}

function nodeAfter(event: PacketEvent): MeshNode {
  const state = emptyMeshState();
  applyRadioEvent(state, { type: "node-info", nodeNum: event.from, user: { id: "!a1b2c3d4", longName: "Bravo-1 with a very long name that exceeds forty", shortName: "B1" }, position: null, lastHeard: null, batteryLevel: 80, snr: null }, receivedAt);
  applyRadioEvent(state, event, receivedAt);
  return state.nodes.get(event.from) as MeshNode;
}

describe("mesh observations", () => {
  it("turns a live position packet into an observation with names, signal and channel index only", () => {
    const event = packet();
    expect(observationOf(event, nodeAfter(event), receivedAt)).toEqual({
      kind: "position",
      nodeNum: 0xa1b2c3d4,
      packetId: 0xfffffff0,
      receivedAt: "2026-10-16T12:00:00.000Z",
      packetTime: new Date(1_791_000_000_000).toISOString(),
      position: { lat: 52.1, lon: 11.6, precisionBits: 13, groundSpeed: 1.5, groundTrack: 90 },
      shortName: "B1",
      longName: "Bravo-1 with a very long name that excee",
      snr: 7.25,
      rssi: -95,
      hopsAway: 2,
      channel: { index: 1 },
    });
  });

  it("forwards node info and skips encrypted, unknown and ID-less packets", () => {
    const info = packet({ position: null, user: { id: "!a1b2c3d4", longName: "Bravo-1", shortName: "B1" } });
    expect(observationOf(info, nodeAfter(info), receivedAt)).toMatchObject({ kind: "nodeinfo", longName: "Bravo-1", shortName: "B1" });
    const node = nodeAfter(packet());
    expect(observationOf(packet({ encrypted: true, position: null }), node, receivedAt)).toBeNull();
    expect(observationOf(packet({ position: null }), node, receivedAt)).toBeNull();
    expect(observationOf(packet({ packetId: 0 }), node, receivedAt)).toBeNull();
  });

  it("leaves out values Core would reject instead of failing the batch", () => {
    const event = packet({ snr: 80, rssi: 12, hopsAway: 9 });
    const observation = observationOf(event, nodeAfter(event), receivedAt);
    expect(observation).not.toHaveProperty("snr");
    expect(observation).not.toHaveProperty("rssi");
    expect(observation).not.toHaveProperty("hopsAway");
  });
});

/** An in-memory outbox with the same contract as the IndexedDB one. */
function memoryOutbox(): Outbox & { entries: OutboxEntry[] } {
  let next = 1;
  const outbox = {
    entries: [] as OutboxEntry[],
    append(observations: readonly MeshObservation[]) {
      for (const observation of observations) outbox.entries.push({ id: next++, observation });
      return Promise.resolve(0);
    },
    peek: (limit: number) => Promise.resolve(outbox.entries.slice(0, limit)),
    remove(ids: readonly number[]) {
      outbox.entries = outbox.entries.filter(({ id }) => !ids.includes(id));
      return Promise.resolve();
    },
    pruneExpired: () => Promise.resolve(0),
    count: () => Promise.resolve(outbox.entries.length),
    clear() {
      outbox.entries = [];
      return Promise.resolve();
    },
  };
  return outbox;
}

function observation(packetId: number): MeshObservation {
  return { kind: "nodeinfo", nodeNum: 1, packetId, receivedAt: receivedAt.toISOString(), shortName: "B1" };
}

function ok(observations: MeshObservation[], status: "accepted" | "duplicate" = "accepted"): SendOutcome {
  const count = observations.length;
  return {
    kind: "ok",
    result: {
      accepted: status === "accepted" ? count : 0,
      duplicates: status === "duplicate" ? count : 0,
      takPreferred: 0,
      rejected: 0,
      recorded: 0,
      results: observations.map(() => ({ status })),
    },
  };
}

describe("mesh uplink", () => {
  let status: UplinkStatus;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends in receive order, in batches of at most 200, and empties the outbox after each 200", async () => {
    const outbox = memoryOutbox();
    for (let id = 1; id <= 250; id += 1) await outbox.append([observation(id)]);
    const sent: number[][] = [];
    const uplink = new MeshUplink(outbox, (batch) => {
      sent.push(batch.map(({ packetId }) => packetId));
      return Promise.resolve(ok(batch));
    }, (next) => (status = next));
    await uplink.start();
    await vi.runAllTimersAsync();
    expect(sent.map((batch) => batch.length)).toEqual([200, 50]);
    expect(sent.flat()).toEqual(Array.from({ length: 250 }, (_, index) => index + 1));
    expect(outbox.entries).toEqual([]);
    expect(status).toMatchObject({ queued: 0, sent: 250, lastError: null });
  });

  it("keeps the outbox on network errors and retries after the delay", async () => {
    const outbox = memoryOutbox();
    let online = false;
    const uplink = new MeshUplink(outbox, (batch) => Promise.resolve(online ? ok(batch, "duplicate") : { kind: "network", message: "offline" }), (next) => (status = next));
    await uplink.start();
    uplink.observe(observation(1));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(status).toMatchObject({ queued: 1, lastError: "offline" });
    online = true;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(status).toMatchObject({ queued: 0, sent: 1, duplicates: 1, lastError: null });
  });

  it("waits as long as a 429 says", async () => {
    const outbox = memoryOutbox();
    await outbox.append([observation(1)]);
    const send = vi.fn<(batch: MeshObservation[]) => Promise<SendOutcome>>()
      .mockResolvedValueOnce({ kind: "problem", status: 429, message: "Too many", retryAfterMs: 20_000 })
      .mockImplementation((batch) => Promise.resolve(ok(batch)));
    const uplink = new MeshUplink(outbox, send, (next) => (status = next));
    await uplink.start();
    await vi.advanceTimersByTimeAsync(19_000);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(outbox.entries).toEqual([]);
  });

  it("splits a batch Core cannot read until the bad observation is dropped as rejected", async () => {
    const outbox = memoryOutbox();
    await outbox.append([1, 2, 3, 4].map(observation));
    const uplink = new MeshUplink(outbox, (batch) =>
      Promise.resolve(batch.some(({ packetId }) => packetId === 3) ? { kind: "problem", status: 422, message: "Invalid", retryAfterMs: null } : ok(batch)),
    (next) => (status = next));
    await uplink.start();
    await vi.runAllTimersAsync();
    expect(outbox.entries).toEqual([]);
    expect(status).toMatchObject({ sent: 3, rejected: 1 });
  });

  it("stops queuing once stopped and clears on request", async () => {
    const outbox = memoryOutbox();
    const uplink = new MeshUplink(outbox, () => Promise.resolve({ kind: "network", message: "offline" }), (next) => (status = next));
    await uplink.start();
    uplink.observe(observation(1));
    await vi.advanceTimersByTimeAsync(0);
    uplink.stop();
    uplink.observe(observation(2));
    await uplink.clear();
    expect(outbox.entries).toEqual([]);
    expect(status.queued).toBe(0);
  });
});

describe("uplink helpers", () => {
  it("reads Retry-After in seconds or as a date, and the RateLimit reset", () => {
    const now = Date.parse("2026-10-16T12:00:00.000Z");
    expect(retryAfterMs(new Headers({ "Retry-After": "12" }), now)).toBe(12_000);
    expect(retryAfterMs(new Headers({ "Retry-After": "Fri, 16 Oct 2026 12:00:30 GMT" }), now)).toBe(30_000);
    expect(retryAfterMs(new Headers({ RateLimit: '"300-in-1min";r=0;t=42' }), now)).toBe(42_000);
    expect(retryAfterMs(new Headers(), now)).toBeNull();
  });

  it("reads node IDs as the Meshtastic apps show them", () => {
    expect(parseNodeNumber("!a1b2c3d4")).toBe(0xa1b2c3d4);
    expect(parseNodeNumber("A1B2C3D4")).toBe(0xa1b2c3d4);
    expect(parseNodeNumber("12345678")).toBe(12_345_678);
    expect(parseNodeNumber("!ffffffff")).toBeNull();
    expect(parseNodeNumber("0")).toBeNull();
    expect(parseNodeNumber("bravo")).toBeNull();
  });
});
