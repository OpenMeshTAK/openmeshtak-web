import type { Schemas } from "@/shared/api/types";

type Connection = Schemas["LiveTakConnectionDto"];
type Item = Schemas["LiveTakItemDto"];
type MeshDetails = Schemas["LiveMeshDetailsDto"];

/** Row key prefix of a Meshtastic node that no member is bound to. */
export const UNBOUND_MESH_PREFIX = "mesh:";

/**
 * Which contact row of the Live panel an item belongs to: the connection that sent it while that
 * app is connected; after a reconnect the same user's current app; otherwise a row for the
 * disconnected sender (`user:<id>`), because Core keeps their markers on the map. Hiding a row or
 * its group therefore hides the markers that member placed, not only their own position.
 *
 * Mesh positions of a bound node name the member without a connection, so they join that
 * member's row like a marker sent before a reconnect. Unbound nodes have no sender and get a row
 * of their own per node (`mesh:<node>`).
 */
export function contactKeyOf(item: Item, connectionIds: ReadonlySet<string>, connectionByUser: ReadonlyMap<string, string>): string {
  const sender = item.placedBy;
  if (sender === null) return `${UNBOUND_MESH_PREFIX}${item.mesh?.nodeId ?? item.uid}`;
  if (sender.connectionId !== null && connectionIds.has(sender.connectionId)) return sender.connectionId;
  return connectionByUser.get(sender.userId) ?? `user:${sender.userId}`;
}

/** Items grouped by their contact row key, built once per update. */
export function itemsByContact(connections: readonly Connection[], items: readonly Item[]): Map<string, Item[]> {
  const connectionIds = new Set(connections.map(({ id }) => id));
  const connectionByUser = new Map<string, string>();
  for (const { id, userId } of connections) {
    if (!connectionByUser.has(userId)) connectionByUser.set(userId, id);
  }
  const byContact = new Map<string, Item[]>();
  for (const item of items) {
    const key = contactKeyOf(item, connectionIds, connectionByUser);
    const list = byContact.get(key);
    if (list === undefined) byContact.set(key, [item]);
    else list.push(item);
  }
  return byContact;
}

/** The items whose contact row is not hidden. */
export function visibleItems(byContact: ReadonlyMap<string, readonly Item[]>, hidden: ReadonlySet<string>): Item[] {
  return [...byContact].flatMap(([key, items]) => (hidden.has(key) ? [] : items));
}

/** The newest item of a list, by the sender's time. */
export function newestItem(items: readonly Item[]): Item | undefined {
  let newest: Item | undefined;
  for (const item of items) {
    if (newest === undefined || Date.parse(item.time) > Date.parse(newest.time)) newest = item;
  }
  return newest;
}

/** `!a1b2c3d4 (B1)`: how operators recognise a node in the Meshtastic apps. */
export function meshNodeName(mesh: Pick<MeshDetails, "nodeId" | "shortName">): string {
  return mesh.shortName === null ? mesh.nodeId : `${mesh.nodeId} (${mesh.shortName})`;
}

/** Name of an HQ for people; HQs without a name are told apart by the start of their ID. */
export function hqLabel(hq: { id: string; name: string | null }): string {
  return hq.name ?? `HQ ${hq.id.slice(0, 8)}`;
}

/** Row-menu lines that say where a mesh position came from: node, HQ and signal. */
export function meshProvenance(mesh: MeshDetails): string[] {
  const signal = [
    mesh.batteryLevel === null ? null : mesh.batteryLevel > 100 ? "Powered" : `Battery ${String(Math.round(mesh.batteryLevel))} %`,
    mesh.snr === null ? null : `SNR ${String(mesh.snr)} dB`,
    mesh.rssi === null ? null : `RSSI ${String(mesh.rssi)} dBm`,
    mesh.hopsAway === null ? null : mesh.hopsAway === 0 ? "Direct" : `${String(mesh.hopsAway)} hops`,
  ].filter((part) => part !== null);
  return [
    `Meshtastic ${meshNodeName(mesh)}`,
    `Heard by ${hqLabel(mesh.hq)}${mesh.channel === null ? "" : ` on channel ${mesh.channel.name ?? String(mesh.channel.index)}`}`,
    ...(signal.length === 0 ? [] : [signal.join(" · ")]),
  ];
}
