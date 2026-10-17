import { openDatabase, requestResult, transactionDone } from "../offline-store";
import type { MeshObservation } from "./mesh-observation";

/**
 * The uplink outbox: observations of one event waiting to be sent to Core, in receive order. It is
 * the one deliberate place where the HQ keeps positions in the browser, and only while the uplink
 * is switched on for that event (see offline.md, "Mesh uplink"). Both limits keep it bounded: older
 * entries than Core would still accept are useless, and a full outbox drops its oldest entries.
 */
export const OUTBOX_MAX_ENTRIES = 50_000;
export const OUTBOX_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export interface OutboxEntry {
  id: number;
  observation: MeshObservation;
}

interface StoredEntry {
  id?: number;
  eventId: string;
  /** HQ receive time in milliseconds, for the age limit. */
  receivedAt: number;
  observation: MeshObservation;
}

/** What the uplink needs from its outbox; tests use an in-memory one. */
export interface Outbox {
  /** Appends observations in order and returns how many old entries the size limit dropped. */
  append(observations: readonly MeshObservation[]): Promise<number>;
  /** The oldest entries, at most `limit`. */
  peek(limit: number): Promise<OutboxEntry[]>;
  remove(ids: readonly number[]): Promise<void>;
  /** Drops entries older than the age limit and returns how many. */
  pruneExpired(now: number): Promise<number>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

/** Deletes the event's oldest `limit` entries inside the open transaction; returns a live count. */
function deleteOldest(transaction: IDBTransaction, eventId: string, limit: number): { deleted: number } {
  const result = { deleted: 0 };
  const store = transaction.objectStore("outbox");
  const request = store.index("eventId").openKeyCursor(IDBKeyRange.only(eventId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor === null || result.deleted >= limit) return;
    store.delete(cursor.primaryKey);
    result.deleted += 1;
    cursor.continue();
  };
  return result;
}

/** The outbox of one event in the `openmeshtak-offline` IndexedDB. */
export function indexedDbOutbox(eventId: string): Outbox {
  const outboxCount = async (): Promise<number> => {
    const database = await openDatabase();
    return requestResult(database.transaction("outbox").objectStore("outbox").index("eventId").count(IDBKeyRange.only(eventId)));
  };
  return {
    async append(observations) {
      if (observations.length === 0) return 0;
      const before = await outboxCount();
      const database = await openDatabase();
      const transaction = database.transaction("outbox", "readwrite");
      const store = transaction.objectStore("outbox");
      for (const observation of observations) {
        const entry: StoredEntry = { eventId, receivedAt: Date.parse(observation.receivedAt), observation };
        store.add(entry);
      }
      // The new entries have the highest keys, so dropping the oldest never drops them.
      const dropped = deleteOldest(transaction, eventId, Math.max(0, before + observations.length - OUTBOX_MAX_ENTRIES));
      await transactionDone(transaction);
      return dropped.deleted;
    },
    async peek(limit) {
      const database = await openDatabase();
      const index = database.transaction("outbox").objectStore("outbox").index("eventId");
      const entries = await requestResult(index.getAll(IDBKeyRange.only(eventId), limit) as IDBRequest<StoredEntry[]>);
      return entries.map(({ id, observation }) => ({ id: id as number, observation }));
    },
    async remove(ids) {
      if (ids.length === 0) return;
      const database = await openDatabase();
      const transaction = database.transaction("outbox", "readwrite");
      const store = transaction.objectStore("outbox");
      for (const id of ids) store.delete(id);
      await transactionDone(transaction);
    },
    async pruneExpired(now) {
      const database = await openDatabase();
      const transaction = database.transaction("outbox", "readwrite");
      const store = transaction.objectStore("outbox");
      const request = store.index("eventId").openCursor(IDBKeyRange.only(eventId));
      let dropped = 0;
      // Entries are in receive order, so the first one young enough ends the scan.
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor === null) return;
        const entry = cursor.value as StoredEntry;
        if (now - entry.receivedAt <= OUTBOX_MAX_AGE_MS) return;
        cursor.delete();
        dropped += 1;
        cursor.continue();
      };
      await transactionDone(transaction);
      return dropped;
    },
    count: outboxCount,
    async clear() {
      const database = await openDatabase();
      const transaction = database.transaction("outbox", "readwrite");
      deleteOldest(transaction, eventId, Number.POSITIVE_INFINITY);
      await transactionDone(transaction);
    },
  };
}

/** Removes the unsent observations of one event, e.g. when its offline data is cleared. */
export function clearOutbox(eventId: string): Promise<void> {
  return indexedDbOutbox(eventId).clear();
}
