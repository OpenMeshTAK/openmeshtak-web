import type { LiveMapItem } from "@/modules/editor/map/live-layer";
import type { RadioEvent, RadioPosition } from "./radio-messages";

/**
 * What the HQ knows about one mesh node. Times use this computer's clock when a packet arrives
 * ("heard live"); entries from the radio's node database keep the radio's own time, which may be
 * old or missing, and are never shown as fresh.
 */
export interface MeshNode {
  num: number;
  /** `!a1b2c3d4`, derived from the node number when the node never sent its user info. */
  id: string;
  longName: string | null;
  shortName: string | null;
  position: RadioPosition | null;
  /** When this computer received the position, or the radio's last-heard time for node database entries. */
  positionAt: Date | null;
  lastHeardAt: Date | null;
  /** At least one packet of this node arrived while connected. */
  heardLive: boolean;
  batteryLevel: number | null;
  snr: number | null;
  rssi: number | null;
  /** The HQ radio itself. */
  isOwnRadio: boolean;
}

export interface MeshState {
  ownNodeNum: number | null;
  nodes: Map<number, MeshNode>;
  /** Recently seen `from:id` keys, so a packet delivered twice is counted once. */
  recentPackets: string[];
}

const RECENT_PACKET_LIMIT = 500;
/** Radio clocks before this are unset; positions from them have an unknown age. */
const EARLIEST_PLAUSIBLE_TIME = Date.UTC(2020, 0, 1);
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export function emptyMeshState(): MeshState {
  return { ownNodeNum: null, nodes: new Map(), recentPackets: [] };
}

export function nodeIdOf(num: number): string {
  return `!${(num >>> 0).toString(16).padStart(8, "0")}`;
}

/** A radio-clock time in seconds, or `null` when it cannot be right. */
export function plausibleTime(seconds: number | null, now: Date): Date | null {
  if (seconds === null) {
    return null;
  }
  const time = seconds * 1000;
  return time < EARLIEST_PLAUSIBLE_TIME || time > now.getTime() + CLOCK_TOLERANCE_MS ? null : new Date(time);
}

function nodeOf(state: MeshState, num: number): MeshNode {
  let node = state.nodes.get(num);
  if (node === undefined) {
    node = {
      num,
      id: nodeIdOf(num),
      longName: null,
      shortName: null,
      position: null,
      positionAt: null,
      lastHeardAt: null,
      heardLive: false,
      batteryLevel: null,
      snr: null,
      rssi: null,
      isOwnRadio: num === state.ownNodeNum,
    };
    state.nodes.set(num, node);
  }
  return node;
}

function isDuplicate(state: MeshState, from: number, packetId: number): boolean {
  // Packet ID 0 is not unique; such packets cannot be deduplicated.
  if (packetId === 0) {
    return false;
  }
  const key = `${String(from)}:${String(packetId)}`;
  if (state.recentPackets.includes(key)) {
    return true;
  }
  state.recentPackets.push(key);
  if (state.recentPackets.length > RECENT_PACKET_LIMIT) {
    state.recentPackets.shift();
  }
  return false;
}

/** Applies one radio event in place. Returns `true` when the visible picture changed. */
export function applyRadioEvent(state: MeshState, event: RadioEvent, now: Date): boolean {
  switch (event.type) {
    case "my-info": {
      state.ownNodeNum = event.nodeNum;
      for (const node of state.nodes.values()) node.isOwnRadio = node.num === event.nodeNum;
      return true;
    }
    case "node-info": {
      const node = nodeOf(state, event.nodeNum);
      if (event.user !== null) {
        node.id = event.user.id || node.id;
        node.longName = event.user.longName || node.longName;
        node.shortName = event.user.shortName || node.shortName;
      }
      // The node database never overrides what this session received live.
      if (!node.heardLive) {
        const lastHeard = plausibleTime(event.lastHeard, now);
        node.lastHeardAt = lastHeard;
        if (event.position !== null) {
          node.position = event.position;
          node.positionAt = lastHeard;
        }
        node.batteryLevel = event.batteryLevel ?? node.batteryLevel;
        node.snr = event.snr ?? node.snr;
      }
      return true;
    }
    case "packet": {
      if (isDuplicate(state, event.from, event.packetId)) {
        return false;
      }
      const node = nodeOf(state, event.from);
      node.heardLive = true;
      node.lastHeardAt = now;
      node.snr = event.snr ?? node.snr;
      node.rssi = event.rssi ?? node.rssi;
      if (event.user !== null) {
        node.id = event.user.id || node.id;
        node.longName = event.user.longName || node.longName;
        node.shortName = event.user.shortName || node.shortName;
      }
      if (event.position !== null) {
        node.position = event.position;
        node.positionAt = now;
      }
      if (event.batteryLevel !== null) {
        node.batteryLevel = event.batteryLevel;
      }
      return true;
    }
    default:
      return false;
  }
}

export function nodeLabel(node: MeshNode): string {
  return node.longName ?? node.shortName ?? node.id;
}

/** A position is stale when its age is unknown or above the threshold. */
export function isStale(node: MeshNode, now: Date, staleAfterMs: number): boolean {
  return node.positionAt === null || now.getTime() - node.positionAt.getTime() > staleAfterMs;
}

/** Map markers for every node with a known position; nodes without one are only listed. */
export function meshLiveItems(nodes: Iterable<MeshNode>, now: Date, staleAfterMs: number): LiveMapItem[] {
  return [...nodes].flatMap((node) =>
    node.position === null
      ? []
      : [
          {
            uid: `mesh:${node.id}`,
            type: "mesh",
            callsign: nodeLabel(node),
            lat: node.position.lat,
            lon: node.position.lon,
            source: "mesh" as const,
            outdated: isStale(node, now, staleAfterMs),
          },
        ],
  );
}
