import type { Schemas } from "@/shared/api/types";
import type { MeshObservation } from "./mesh-observation";
import type { Outbox } from "./uplink-outbox";

export type BatchResult = Schemas["MeshObservationBatchResultDto"];

/** Core accepts at most this many observations per request. */
export const MAX_BATCH = 200;
/** Packets arriving close together go out in one request instead of one each. */
const GATHER_MS = 2_000;
const FIRST_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;
/** Without a Retry-After header, a rate-limited HQ waits this long. */
const RATE_LIMIT_WAIT_MS = 30_000;

/** What one upload attempt returned, as the uplink needs it. */
export type SendOutcome =
  | { kind: "ok"; result: BatchResult }
  | { kind: "problem"; status: number; message: string; retryAfterMs: number | null }
  | { kind: "network"; message: string };

export type SendBatch = (observations: MeshObservation[]) => Promise<SendOutcome>;

export interface UplinkStatus {
  /** Observations waiting in the outbox. */
  queued: number;
  /** Observations Core answered this session: accepted, duplicate or TAK-preferred. */
  sent: number;
  duplicates: number;
  takPreferred: number;
  rejected: number;
  /** Observations the outbox limits dropped before they could be sent. */
  dropped: number;
  lastSentAt: number | null;
  lastError: string | null;
  /** When the next attempt is due after an error or a rate limit; null while not waiting. */
  retryAt: number | null;
}

export function emptyStatus(): UplinkStatus {
  return { queued: 0, sent: 0, duplicates: 0, takPreferred: 0, rejected: 0, dropped: 0, lastSentAt: null, lastError: null, retryAt: null };
}

/**
 * Sends the outbox to Core in receive order. Every observation passes through the outbox, so a
 * closed tab, a crash or a lost connection never loses what was heard while the uplink was on.
 * After any 200 answer the whole batch is deleted, because Core's per-observation status is final
 * (`duplicate` covers retries). Errors keep the outbox and retry with a growing delay; a structural
 * `422` splits the batch until the one bad observation is found and dropped as rejected.
 */
export class MeshUplink {
  private status: UplinkStatus = emptyStatus();
  private running = false;
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryDelay = FIRST_RETRY_MS;
  private batchLimit = MAX_BATCH;
  /** Appends run one after another so their entries keep the receive order. */
  private appends: Promise<void> = Promise.resolve();

  public constructor(
    private readonly outbox: Outbox,
    private readonly send: SendBatch,
    private readonly onChange: (status: UplinkStatus) => void,
    private readonly now: () => number = Date.now,
  ) {}

  public get current(): UplinkStatus {
    return this.status;
  }

  /** Starts sending what the outbox holds and everything observed from now on. */
  public async start(): Promise<void> {
    this.stopped = false;
    await this.refreshQueued();
    this.schedule(0);
  }

  /** Stops sending; the outbox stays until `clear`. */
  public stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.update({ retryAt: null });
  }

  /** Sends now, e.g. when the network returns, instead of waiting for the retry delay. */
  public wake(): void {
    if (this.stopped) return;
    this.retryDelay = FIRST_RETRY_MS;
    this.schedule(0);
  }

  public observe(observation: MeshObservation): void {
    if (this.stopped) return;
    this.appends = this.appends
      .then(async () => {
        const dropped = await this.outbox.append([observation]);
        this.update({ dropped: this.status.dropped + dropped });
        await this.refreshQueued();
      })
      .catch((error: unknown) => {
        this.update({ lastError: error instanceof Error ? error.message : "The outbox could not be written." });
      });
    if (this.timer === undefined && !this.running) this.schedule(GATHER_MS);
  }

  /** Deletes every unsent observation of the event. */
  public async clear(): Promise<void> {
    await this.appends;
    await this.outbox.clear();
    await this.refreshQueued();
  }

  private update(patch: Partial<UplinkStatus>): void {
    this.status = { ...this.status, ...patch };
    this.onChange(this.status);
  }

  private async refreshQueued(): Promise<void> {
    this.update({ queued: await this.outbox.count() });
  }

  private schedule(delayMs: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delayMs);
  }

  private wait(delayMs: number, message: string | null): void {
    this.update({ retryAt: this.now() + delayMs, ...(message === null ? {} : { lastError: message }) });
    this.schedule(delayMs);
  }

  private async flush(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    this.update({ retryAt: null });
    try {
      await this.appends;
      const expired = await this.outbox.pruneExpired(this.now());
      if (expired > 0) this.update({ dropped: this.status.dropped + expired });
      while (!this.stopped) {
        const entries = await this.outbox.peek(this.batchLimit);
        if (entries.length === 0) break;
        const outcome = await this.send(entries.map(({ observation }) => observation));
        if (!(await this.handle(outcome, entries.map(({ id }) => id)))) break;
      }
    } catch (error: unknown) {
      this.wait(this.nextRetryDelay(), error instanceof Error ? error.message : "The outbox could not be read.");
    } finally {
      this.running = false;
      await this.refreshQueued().catch(() => undefined);
      // Something observed while the last batch was on its way.
      if (!this.stopped && this.timer === undefined && this.status.queued > 0) this.schedule(GATHER_MS);
    }
  }

  /** Applies one outcome; returns whether to send the next batch right away. */
  private async handle(outcome: SendOutcome, ids: number[]): Promise<boolean> {
    if (outcome.kind === "ok") {
      await this.outbox.remove(ids);
      this.retryDelay = FIRST_RETRY_MS;
      this.batchLimit = MAX_BATCH;
      const { accepted, duplicates, takPreferred, rejected } = outcome.result;
      this.update({
        sent: this.status.sent + accepted + duplicates + takPreferred,
        duplicates: this.status.duplicates + duplicates,
        takPreferred: this.status.takPreferred + takPreferred,
        rejected: this.status.rejected + rejected,
        lastSentAt: this.now(),
        lastError: null,
      });
      await this.refreshQueued();
      return true;
    }
    if (outcome.kind === "problem" && outcome.status === 422) {
      if (ids.length > 1) {
        this.batchLimit = Math.max(1, Math.floor(ids.length / 2));
        return true;
      }
      // One observation Core cannot read at all would block the outbox forever.
      await this.outbox.remove(ids);
      this.update({ rejected: this.status.rejected + 1, lastError: outcome.message });
      return true;
    }
    if (outcome.kind === "problem" && outcome.status === 429) {
      this.wait(outcome.retryAfterMs ?? RATE_LIMIT_WAIT_MS, null);
      return false;
    }
    // Network failures, server errors, an expired session or an event that is not active: keep
    // everything and try again later; the operator sees the error meanwhile.
    this.wait(this.nextRetryDelay(), outcome.message);
    return false;
  }

  private nextRetryDelay(): number {
    const delay = this.retryDelay;
    this.retryDelay = Math.min(MAX_RETRY_MS, this.retryDelay * 2);
    return delay;
  }
}
