import { create, toBinary } from "@bufbuild/protobuf";
import { Mesh, Portnums } from "@meshtastic/protobufs";
import { describe, expect, it } from "vitest";
import { applyRadioEvent, emptyMeshState, meshLiveItems, plausibleTime } from "@/modules/offline/meshtastic/mesh-nodes";
import { decodeFromRadio, encodeWantConfig, type RadioEvent } from "@/modules/offline/meshtastic/radio-messages";
import { encodeFrame, FrameDecoder } from "@/modules/offline/meshtastic/serial-frames";

function fromRadio(variant: Mesh.FromRadio["payloadVariant"]): Uint8Array {
  return toBinary(Mesh.FromRadioSchema, create(Mesh.FromRadioSchema, { payloadVariant: variant }));
}

function positionPacket(from: number, id: number, latitudeI: number, longitudeI: number): Uint8Array {
  const payload = toBinary(Mesh.PositionSchema, create(Mesh.PositionSchema, { latitudeI, longitudeI, time: 1_790_000_000 }));
  return fromRadio({
    case: "packet",
    value: create(Mesh.MeshPacketSchema, {
      from,
      id,
      channel: 0,
      payloadVariant: { case: "decoded", value: create(Mesh.DataSchema, { portnum: Portnums.PortNum.POSITION_APP, payload }) },
    }),
  });
}

describe("Meshtastic serial framing", () => {
  it("splits frames, skips debug text and waits for split frames", () => {
    const decoder = new FrameDecoder();
    const first = encodeFrame(new Uint8Array([1, 2, 3]));
    const second = encodeFrame(new Uint8Array([4, 5]));
    const stream = new Uint8Array([...new TextEncoder().encode("DEBUG | boot\r\n"), ...first, ...second]);

    expect(decoder.push(stream.slice(0, 23))).toEqual([new Uint8Array([1, 2, 3])]);
    expect(decoder.push(stream.slice(23))).toEqual([new Uint8Array([4, 5])]);
  });

  it("resynchronises after a header with an impossible length", () => {
    const decoder = new FrameDecoder();
    const broken = new Uint8Array([0x94, 0xc3, 0xff, 0xff]);
    expect(decoder.push(new Uint8Array([...broken, ...encodeFrame(new Uint8Array([9]))]))).toEqual([new Uint8Array([9])]);
    expect(decoder.invalidFrames).toBe(1);
  });

  it("encodes a want-config request inside a frame", () => {
    const frame = encodeFrame(encodeWantConfig(42));
    expect([...frame.slice(0, 2)]).toEqual([0x94, 0xc3]);
    expect((frame[2]! << 8) | frame[3]!).toBe(frame.length - 4);
  });
});

describe("FromRadio decoding", () => {
  it("reads live positions and ignores 0/0 as no fix", () => {
    const event = decodeFromRadio(positionPacket(0x1234, 7, 523_700_000, 118_100_000));
    expect(event).toMatchObject({ type: "packet", from: 0x1234, position: { lat: 52.37, lon: 11.81, time: 1_790_000_000 } });
    expect(decodeFromRadio(positionPacket(0x1234, 8, 0, 0))).toMatchObject({ type: "packet", position: null });
  });

  it("reads node database entries", () => {
    const bytes = fromRadio({
      case: "nodeInfo",
      value: create(Mesh.NodeInfoSchema, {
        num: 0xabcd,
        user: create(Mesh.UserSchema, { id: "!0000abcd", longName: "Alpha Lead", shortName: "AL" }),
        lastHeard: 1_790_000_000,
      }),
    });
    expect(decodeFromRadio(bytes)).toMatchObject({ type: "node-info", nodeNum: 0xabcd, user: { shortName: "AL" }, position: null });
  });

  it("marks packets it cannot decrypt as encrypted", () => {
    const bytes = fromRadio({
      case: "packet",
      value: create(Mesh.MeshPacketSchema, { from: 5, id: 1, payloadVariant: { case: "encrypted", value: new Uint8Array([1, 2]) } }),
    });
    expect(decodeFromRadio(bytes)).toMatchObject({ type: "packet", from: 5, encrypted: true, position: null });
  });

  it("rejects bytes that are not a FromRadio message", () => {
    expect(() => decodeFromRadio(new Uint8Array([0xff, 0xff, 0xff]))).toThrow();
  });
});

describe("mesh node state", () => {
  const now = new Date("2026-10-09T12:00:00Z");

  it("counts a duplicated packet once and uses the local receive time", () => {
    const state = emptyMeshState();
    const event = decodeFromRadio(positionPacket(0x1234, 7, 523_700_000, 118_100_000)) as RadioEvent;
    expect(applyRadioEvent(state, event, now)).toBe(true);
    expect(applyRadioEvent(state, event, new Date(now.getTime() + 1000))).toBe(false);
    const node = state.nodes.get(0x1234)!;
    expect(node.positionAt).toEqual(now);
    expect(node.heardLive).toBe(true);
    expect(meshLiveItems(state.nodes.values(), now, 60_000)).toEqual([
      expect.objectContaining({ uid: "mesh:!00001234", source: "mesh", outdated: false }),
    ]);
  });

  it("never shows node database positions as fresh when the radio clock is unset", () => {
    const state = emptyMeshState();
    applyRadioEvent(
      state,
      { type: "node-info", nodeNum: 9, user: null, position: { lat: 1, lon: 2, altitude: null, time: null }, lastHeard: 1000, batteryLevel: null, snr: null },
      now,
    );
    expect(state.nodes.get(9)?.positionAt).toBeNull();
    expect(meshLiveItems(state.nodes.values(), now, 60 * 60_000)[0]?.outdated).toBe(true);
  });

  it("labels map markers with the long name and falls back to the short name", () => {
    const state = emptyMeshState();
    const position = { lat: 1, lon: 2, altitude: null, time: null };
    const nodeInfo = { type: "node-info", position, lastHeard: null, batteryLevel: null, snr: null } as const;
    applyRadioEvent(state, { ...nodeInfo, nodeNum: 1, user: { id: "!00000001", longName: "Wolf Alpha", shortName: "Wolf" } }, now);
    applyRadioEvent(state, { ...nodeInfo, nodeNum: 2, user: { id: "!00000002", longName: "", shortName: "TNG" } }, now);
    expect(meshLiveItems(state.nodes.values(), now, 60_000).map(({ callsign }) => callsign)).toEqual(["Wolf Alpha", "TNG"]);
  });

  it("does not let the node database override live data", () => {
    const state = emptyMeshState();
    applyRadioEvent(state, decodeFromRadio(positionPacket(9, 1, 100_000_000, 100_000_000)) as RadioEvent, now);
    applyRadioEvent(
      state,
      { type: "node-info", nodeNum: 9, user: null, position: { lat: 5, lon: 5, altitude: null, time: null }, lastHeard: 1_700_000_000, batteryLevel: null, snr: null },
      now,
    );
    expect(state.nodes.get(9)?.position?.lat).toBe(10);
  });

  it("accepts only plausible radio clock times", () => {
    expect(plausibleTime(1000, now)).toBeNull();
    expect(plausibleTime(now.getTime() / 1000 + 3600, now)).toBeNull();
    expect(plausibleTime(now.getTime() / 1000 - 60, now)).toEqual(new Date(now.getTime() - 60_000));
  });
});
