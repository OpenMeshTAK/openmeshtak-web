import type { Schemas } from "@/shared/api/types";
import type { MeshNode } from "../meshtastic/mesh-nodes";
import type { RadioEvent } from "../meshtastic/radio-messages";

export type MeshObservation = Schemas["MeshObservationDto"];
type PacketEvent = Extract<RadioEvent, { type: "packet" }>;

/** Core's limits for the names a node announces; longer names are cut, never rejected. */
const SHORT_NAME_MAX = 8;
const LONG_NAME_MAX = 40;
const UINT32_MAX = 0xffff_ffff;

/** Cuts by characters, not UTF-16 units, so an emoji short name is never split in half. */
function cut(text: string, max: number): string | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : Array.from(trimmed).slice(0, max).join("");
}

/** Adds the value only when it lies in Core's accepted range; an odd reading must not fail the whole batch. */
function inRange(value: number | null, min: number, max: number, integer = false): number | undefined {
  if (value === null || !Number.isFinite(value) || value < min || value > max) return undefined;
  return integer ? Math.round(value) : value;
}

/** Drops keys whose value is `undefined`, so the request body has no empty properties. */
function compact<T extends object>(value: { [K in keyof T]?: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/**
 * Turns a packet the radio heard just now into an observation for Core's mesh uplink, or `null`
 * when there is nothing to forward: packets it could not decrypt, other port numbers, positions
 * without a fix and packets without an ID (`0` is not unique, so Core could not deduplicate them).
 * Node database entries never become observations. Only names, position and signal values leave
 * the HQ; channel keys are never read from the radio.
 */
export function observationOf(event: PacketEvent, node: MeshNode, receivedAt: Date): MeshObservation | null {
  if (event.encrypted || event.packetId <= 0 || event.packetId > UINT32_MAX || event.from <= 0 || event.from >= UINT32_MAX) {
    return null;
  }
  const kind = event.position !== null ? "position" : event.user !== null ? "nodeinfo" : null;
  if (kind === null) return null;
  const position = event.position;
  const packetTime = position?.time === null || position?.time === undefined ? undefined : new Date(position.time * 1000).toISOString();
  return compact<MeshObservation>({
    kind,
    nodeNum: event.from >>> 0,
    packetId: event.packetId >>> 0,
    receivedAt: receivedAt.toISOString(),
    packetTime,
    position:
      position === null
        ? undefined
        : compact<Schemas["MeshPositionDto"]>({
            lat: position.lat,
            lon: position.lon,
            precisionBits: position.precisionBits ?? undefined,
            groundSpeed: inRange(position.speed, 0, 1000),
            groundTrack: inRange(position.course, 0, 360),
          }),
    shortName: cut(event.user?.shortName ?? node.shortName ?? "", SHORT_NAME_MAX),
    longName: cut(event.user?.longName ?? node.longName ?? "", LONG_NAME_MAX),
    batteryLevel: node.batteryHeardLive ? inRange(node.batteryLevel, 1, 101, true) : undefined,
    snr: inRange(event.snr, -50, 50),
    rssi: inRange(event.rssi, -200, 0, true),
    hopsAway: inRange(event.hopsAway, 0, 7, true),
    channel: { index: event.channel },
  });
}
