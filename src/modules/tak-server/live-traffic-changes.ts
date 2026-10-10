import type { Schemas } from "@/shared/api/types";

type Connection = Schemas["LiveTakConnectionDto"];
type Item = Schemas["LiveTakItemDto"];

/**
 * Realtime update after the first `traffic` snapshot (Core's `LiveTakTrafficChangesDto`): new or
 * changed connections and items in full, and the ids of those that are gone.
 */
export interface LiveTakTrafficChanges {
  connections: { upserted: Connection[]; removed: string[] };
  items: { upserted: Item[]; removed: string[] };
}

function apply<T>(current: readonly T[], idOf: (value: T) => string, changes: { upserted: T[]; removed: string[] }): T[] {
  const byId = new Map(current.map((value) => [idOf(value), value]));
  for (const id of changes.removed) byId.delete(id);
  for (const value of changes.upserted) byId.set(idOf(value), value);
  return [...byId.values()];
}

/** The traffic after an update; the input stays untouched, so a shallow ref sees a new value. */
export function applyTrafficChanges(traffic: Schemas["LiveTakTrafficDto"], changes: LiveTakTrafficChanges): Schemas["LiveTakTrafficDto"] {
  return {
    connections: apply(traffic.connections, ({ id }) => id, changes.connections),
    items: apply(traffic.items, ({ uid }) => uid, changes.items),
  };
}
