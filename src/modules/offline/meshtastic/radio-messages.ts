import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { Mesh, Portnums, Telemetry } from "@meshtastic/protobufs";

/**
 * Receive-only view of the official Meshtastic protobufs: what the HQ map needs from the radio,
 * nothing else. Configuration, channels and keys the radio reports are deliberately ignored.
 */
export interface RadioUser {
  /** Node ID such as `!a1b2c3d4`. */
  id: string;
  longName: string;
  shortName: string;
}

export interface RadioPosition {
  lat: number;
  lon: number;
  altitude: number | null;
  /** Seconds since 1970 as the sending node's clock reported it; may be wrong or missing. */
  time: number | null;
  /** Direction of travel in degrees from true north; only sent when the node's position flags include heading. */
  course: number | null;
  /** Ground speed in metres per second; only sent when the node's position flags include speed. */
  speed: number | null;
}

export type RadioEvent =
  /** The HQ radio's own node number. */
  | { type: "my-info"; nodeNum: number }
  /** An entry of the radio's node database, sent once after connecting; not a fresh observation. */
  | {
      type: "node-info";
      nodeNum: number;
      user: RadioUser | null;
      position: RadioPosition | null;
      /** Radio clock time the node was last heard, in seconds; `null` when unknown. */
      lastHeard: number | null;
      batteryLevel: number | null;
      snr: number | null;
    }
  /** A packet the radio received just now. Packets it could not decrypt carry no payload. */
  | {
      type: "packet";
      from: number;
      packetId: number;
      channel: number;
      encrypted: boolean;
      user: RadioUser | null;
      position: RadioPosition | null;
      batteryLevel: number | null;
      snr: number | null;
      rssi: number | null;
    }
  | { type: "config-complete"; id: number }
  | { type: "rebooted" };

function positionOf(position: Mesh.Position | undefined): RadioPosition | null {
  if (position?.latitudeI === undefined || position.longitudeI === undefined) {
    return null;
  }
  const lat = position.latitudeI / 1e7;
  const lon = position.longitudeI / 1e7;
  // 0/0 is how firmware reports "no fix"; never draw a node in the Gulf of Guinea for it.
  if ((position.latitudeI === 0 && position.longitudeI === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  // Firmware sends the track in 1e-5 degrees and the speed in km/h (GPS.cpp).
  const course = position.groundTrack === undefined ? null : position.groundTrack / 1e5;
  return {
    lat,
    lon,
    altitude: position.altitude ?? null,
    time: position.time > 0 ? position.time : null,
    course: course !== null && course < 360 ? course : null,
    speed: position.groundSpeed === undefined ? null : position.groundSpeed / 3.6,
  };
}

function userOf(user: Mesh.User | undefined): RadioUser | null {
  return user === undefined ? null : { id: user.id, longName: user.longName, shortName: user.shortName };
}

function nonZero(value: number | undefined): number | null {
  return value === undefined || value === 0 ? null : value;
}

function packetEvent(packet: Mesh.MeshPacket): RadioEvent {
  const base = {
    type: "packet" as const,
    from: packet.from,
    packetId: packet.id,
    channel: packet.channel,
    encrypted: packet.payloadVariant.case !== "decoded",
    user: null as RadioUser | null,
    position: null as RadioPosition | null,
    batteryLevel: null as number | null,
    snr: nonZero(packet.rxSnr),
    rssi: nonZero(packet.rxRssi),
  };
  if (packet.payloadVariant.case !== "decoded") {
    return base;
  }
  const { portnum, payload } = packet.payloadVariant.value;
  // A malformed payload only loses its content; the node still counts as heard.
  try {
    if (portnum === Portnums.PortNum.POSITION_APP) {
      base.position = positionOf(fromBinary(Mesh.PositionSchema, payload));
    } else if (portnum === Portnums.PortNum.NODEINFO_APP) {
      base.user = userOf(fromBinary(Mesh.UserSchema, payload));
    } else if (portnum === Portnums.PortNum.TELEMETRY_APP) {
      const telemetry = fromBinary(Telemetry.TelemetrySchema, payload);
      if (telemetry.variant.case === "deviceMetrics") {
        base.batteryLevel = telemetry.variant.value.batteryLevel ?? null;
      }
    }
  } catch {
    // Ignore the payload; see above.
  }
  return base;
}

/**
 * Decodes one `FromRadio` frame. Returns `null` for frames the HQ view does not use and throws
 * for bytes that are not a valid `FromRadio` message.
 */
export function decodeFromRadio(bytes: Uint8Array): RadioEvent | null {
  const message = fromBinary(Mesh.FromRadioSchema, bytes);
  const variant = message.payloadVariant;
  switch (variant.case) {
    case "myInfo":
      return { type: "my-info", nodeNum: variant.value.myNodeNum };
    case "nodeInfo":
      return {
        type: "node-info",
        nodeNum: variant.value.num,
        user: userOf(variant.value.user),
        position: positionOf(variant.value.position),
        lastHeard: variant.value.lastHeard > 0 ? variant.value.lastHeard : null,
        batteryLevel: variant.value.deviceMetrics?.batteryLevel ?? null,
        snr: nonZero(variant.value.snr),
      };
    case "packet":
      return packetEvent(variant.value);
    case "configCompleteId":
      return { type: "config-complete", id: variant.value };
    case "rebooted":
      return { type: "rebooted" };
    default:
      return null;
  }
}

/** Asks the radio to send its node database and then stream received packets. Changes nothing on it. */
export function encodeWantConfig(id: number): Uint8Array {
  return toBinary(Mesh.ToRadioSchema, create(Mesh.ToRadioSchema, { payloadVariant: { case: "wantConfigId", value: id } }));
}

/** Keeps the serial API session open on firmware that closes idle client connections. */
export function encodeHeartbeat(): Uint8Array {
  return toBinary(Mesh.ToRadioSchema, create(Mesh.ToRadioSchema, { payloadVariant: { case: "heartbeat", value: create(Mesh.HeartbeatSchema) } }));
}
