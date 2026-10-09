import type { OfflineSnapshotDto } from "./offline.api";

/**
 * Browser storage for prepared offline events. This is the deliberate, operator-requested
 * exception to the online-only PWA: published map content of one event lives in IndexedDB, never
 * in the HTTP or service worker cache, and no credentials, keys or member data are stored.
 *
 * Stores: `snapshots` (one record per event), `tiles` and `images` (binary map content keyed by
 * event and content, so one event can be cleared without touching another).
 */
const DATABASE_NAME = "openmeshtak-offline";
const DATABASE_VERSION = 1;

export interface StoredSnapshot {
  eventId: string;
  snapshot: OfflineSnapshotDto;
  /** When this browser finished (or started) storing the snapshot. */
  storedAt: string;
  /** Only `true` after every tile and image was downloaded and checked. */
  complete: boolean;
  /** Tiles stored per content ID; Core skips damaged tiles, so this may be below the cache size. */
  storedTiles: Record<string, number>;
  /** Web app version that stored it, to recognise data from older releases. */
  appVersion: string;
}

let opened: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store offline data."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("snapshots", { keyPath: "eventId" });
      database.createObjectStore("tiles");
      database.createObjectStore("images");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage could not be opened."));
  }).catch((error: unknown) => {
    opened = null;
    throw error;
  });
  return opened;
}

/** Every key of an event starts with its ID, so a key range selects exactly that event. */
function eventRange(eventId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${eventId}|`, `${eventId}|￿`);
}

function contentRange(eventId: string, contentId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${eventId}|${contentId}|`, `${eventId}|${contentId}|￿`);
}

export function tileKey(eventId: string, contentId: string, z: number, x: number, y: number): string {
  return `${eventId}|${contentId}|${String(z)}/${String(x)}/${String(y)}`;
}

export async function listSnapshots(): Promise<StoredSnapshot[]> {
  const database = await openDatabase();
  return requestResult(database.transaction("snapshots").objectStore("snapshots").getAll() as IDBRequest<StoredSnapshot[]>);
}

export async function readSnapshot(eventId: string): Promise<StoredSnapshot | null> {
  const database = await openDatabase();
  const found = await requestResult(database.transaction("snapshots").objectStore("snapshots").get(eventId) as IDBRequest<StoredSnapshot | undefined>);
  return found ?? null;
}

export async function writeSnapshot(record: StoredSnapshot): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("snapshots", "readwrite");
  transaction.objectStore("snapshots").put(record);
  await transactionDone(transaction);
}

/** Stores a batch of tiles in one transaction. */
export async function writeTiles(entries: ReadonlyArray<{ key: string; blob: Blob }>): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("tiles", "readwrite");
  const store = transaction.objectStore("tiles");
  for (const { key, blob } of entries) {
    store.put(blob, key);
  }
  await transactionDone(transaction);
}

export async function readTile(key: string): Promise<Blob | null> {
  const database = await openDatabase();
  const found = await requestResult(database.transaction("tiles").objectStore("tiles").get(key) as IDBRequest<Blob | undefined>);
  return found ?? null;
}

export async function countTiles(eventId: string, contentId: string): Promise<number> {
  const database = await openDatabase();
  return requestResult(database.transaction("tiles").objectStore("tiles").count(contentRange(eventId, contentId)));
}

export async function writeImage(eventId: string, contentId: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("images", "readwrite");
  transaction.objectStore("images").put(blob, `${eventId}|${contentId}`);
  await transactionDone(transaction);
}

export async function readImage(eventId: string, contentId: string): Promise<Blob | null> {
  const database = await openDatabase();
  const found = await requestResult(
    database.transaction("images").objectStore("images").get(`${eventId}|${contentId}`) as IDBRequest<Blob | undefined>,
  );
  return found ?? null;
}

/** Removes the snapshot, map tiles and images of one event from this browser. */
export async function clearEvent(eventId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(["snapshots", "tiles", "images"], "readwrite");
  transaction.objectStore("snapshots").delete(eventId);
  transaction.objectStore("tiles").delete(eventRange(eventId));
  transaction.objectStore("images").delete(eventRange(eventId));
  await transactionDone(transaction);
}
