import type { Schemas } from "@/shared/api/types";

type Connection = Schemas["LiveTakConnectionDto"];
type Item = Schemas["LiveTakItemDto"];

/**
 * Which contact row of the Live panel an item belongs to: the connection that sent it while that
 * app is connected; after a reconnect the same user's current app; otherwise a row for the
 * disconnected sender (`user:<id>`), because Core keeps their markers on the map. Hiding a row or
 * its group therefore hides the markers that member placed, not only their own position.
 */
export function contactKeyOf(item: Item, connectionIds: ReadonlySet<string>, connectionByUser: ReadonlyMap<string, string>): string {
  const { connectionId, userId } = item.placedBy;
  if (connectionIds.has(connectionId)) return connectionId;
  return connectionByUser.get(userId) ?? `user:${userId}`;
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
