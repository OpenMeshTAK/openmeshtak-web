import {
  createOfflineSnapshot,
  downloadOfflineImage,
  listOfflineTiles,
  type OfflineContent,
  type OfflineSnapshotDto,
  type OfflineSnapshotPackage,
} from "./offline.api";
import { clearEvent, countTiles, readImage, readSnapshot, tileKey, writeImage, writeSnapshot, writeTiles, type StoredSnapshot } from "./offline-store";

/** The only snapshot document version this app understands. */
export const OFFLINE_SNAPSHOT_FORMAT = 1;

export interface PrepareProgress {
  /** Tiles and images stored so far. */
  done: number;
  total: number;
}

export class OfflinePreparationError extends Error {}

async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Bytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function itemCount(snapshot: OfflineSnapshotDto): number {
  return snapshot.packages
    .flatMap(({ contents }) => contents)
    .reduce((total, content) => total + (content.kind === "tiles" ? content.tiles : 1), 0);
}

/** Free space the browser reports, or `null` when it does not say. */
async function freeBytes(): Promise<number | null> {
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota === undefined) {
    return null;
  }
  return estimate.quota - (estimate.usage ?? 0);
}

async function storeTiles(
  eventId: string,
  dataPackage: OfflineSnapshotPackage,
  content: Extract<OfflineContent, { kind: "tiles" }>,
  onStored: (count: number) => void,
  signal: AbortSignal,
): Promise<void> {
  let cursor: string | undefined;
  do {
    signal.throwIfAborted();
    const page = await listOfflineTiles({ eventId, packageId: dataPackage.packageId, revision: dataPackage.revision, contentId: content.id }, cursor);
    const entries = await Promise.all(
      page.items.map(async (tile) => {
        const bytes = base64Bytes(tile.data);
        if ((await sha256Hex(bytes)) !== tile.sha256) {
          throw new OfflinePreparationError(`A tile of "${content.name}" arrived damaged. Prepare the event again.`);
        }
        return { key: tileKey(eventId, content.id, tile.z, tile.x, tile.y), blob: new Blob([bytes], { type: tile.mediaType }) };
      }),
    );
    await writeTiles(entries);
    onStored(entries.length);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
}

async function storeImage(
  eventId: string,
  dataPackage: OfflineSnapshotPackage,
  content: Extract<OfflineContent, { kind: "image" }>,
): Promise<void> {
  const blob = await downloadOfflineImage({ eventId, packageId: dataPackage.packageId, revision: dataPackage.revision, contentId: content.id });
  if ((await sha256Hex(await blob.arrayBuffer())) !== content.sha256) {
    throw new OfflinePreparationError(`The image "${content.name}" arrived damaged. Prepare the event again.`);
  }
  // Stored with the type Core vouched for; the map only ever draws it as an image.
  await writeImage(eventId, content.id, new Blob([blob], { type: content.mediaType }));
}

/**
 * Replaces the offline copy of an event with the selected published packages. The stored record
 * stays marked incomplete until every tile and image was downloaded and its checksum matched,
 * so an interrupted preparation can never look ready.
 */
export async function prepareOfflineEvent(
  eventId: string,
  packageIds: string[],
  onProgress: (progress: PrepareProgress) => void,
  signal: AbortSignal,
): Promise<StoredSnapshot> {
  const snapshot = await createOfflineSnapshot(eventId, packageIds);
  if (snapshot.format !== OFFLINE_SNAPSHOT_FORMAT) {
    throw new OfflinePreparationError("The server sent an offline format this app does not know. Update the app and try again.");
  }
  const free = await freeBytes();
  if (free !== null && free < snapshot.estimatedBytes) {
    throw new OfflinePreparationError(
      `This browser has about ${formatBytes(free)} free for offline data, but the event needs about ${formatBytes(snapshot.estimatedBytes)}.`,
    );
  }

  await clearEvent(eventId);
  const record: StoredSnapshot = { eventId, snapshot, storedAt: new Date().toISOString(), complete: false, storedTiles: {}, appVersion: __APP_VERSION__ };
  await writeSnapshot(record);

  const progress: PrepareProgress = { done: 0, total: itemCount(snapshot) };
  onProgress({ ...progress });
  for (const dataPackage of snapshot.packages) {
    for (const content of dataPackage.contents) {
      signal.throwIfAborted();
      if (content.kind === "tiles") {
        await storeTiles(eventId, dataPackage, content, (count) => {
          record.storedTiles[content.id] = (record.storedTiles[content.id] ?? 0) + count;
          progress.done += count;
          onProgress({ ...progress });
        }, signal);
      } else {
        await storeImage(eventId, dataPackage, content);
        progress.done += 1;
        onProgress({ ...progress });
      }
    }
  }

  // Asks the browser not to evict the data under storage pressure; it may still refuse.
  await navigator.storage?.persist?.().catch(() => false);
  const complete: StoredSnapshot = { ...record, storedAt: new Date().toISOString(), complete: true };
  await writeSnapshot(complete);
  return complete;
}

export interface SnapshotCheck {
  /** Content names whose stored tiles or image are missing, e.g. after the browser evicted data. */
  missing: string[];
}

/** Counts what is really stored against what the snapshot promised. */
export async function checkStoredContent(eventId: string): Promise<SnapshotCheck | null> {
  const record = await readSnapshot(eventId);
  if (record === null) {
    return null;
  }
  const missing: string[] = [];
  for (const content of record.snapshot.packages.flatMap(({ contents }) => contents)) {
    const present = content.kind === "tiles"
      ? (await countTiles(eventId, content.id)) >= (record.storedTiles[content.id] ?? content.tiles)
      : (await readImage(eventId, content.id)) !== null;
    if (!present) {
      missing.push(content.name);
    }
  }
  return { missing };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
