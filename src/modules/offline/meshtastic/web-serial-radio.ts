import { logger } from "@/shared/logging/logger";
import { decodeFromRadio, encodeHeartbeat, encodeWantConfig, type RadioEvent } from "./radio-messages";
import { encodeFrame, FrameDecoder, START2 } from "./serial-frames";

/** The parts of the Web Serial API this adapter uses; TypeScript's DOM library does not ship them. */
interface SerialPortLike extends EventTarget {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface SerialLike extends EventTarget {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

export type RadioStatus = "idle" | "connecting" | "connected" | "disconnected";

export interface RadioCallbacks {
  onEvent(event: RadioEvent): void;
  onStatus(status: RadioStatus, message: string | null): void;
}

/** Meshtastic serial consoles run at 115200 baud. */
const BAUD_RATE = 115_200;
const HEARTBEAT_MS = 5 * 60 * 1000;

function serial(): SerialLike | null {
  return "serial" in navigator ? (navigator as Navigator & { serial: SerialLike }).serial : null;
}

export function webSerialSupported(): boolean {
  return window.isSecureContext && serial() !== null;
}

/** Explains the usual Web Serial failures in operator terms. */
function describeOpenError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "InvalidStateError" || name === "NetworkError") {
    return "The radio's port is in use by another program, such as the Meshtastic app or a serial monitor. Close it and try again.";
  }
  if (name === "SecurityError") {
    return "The browser blocked access to the USB port.";
  }
  return "The radio could not be opened. Unplug it, plug it in again and try again.";
}

/**
 * Receive-only Meshtastic radio over Web Serial. After opening the port it sends exactly two
 * kinds of `ToRadio` messages: `want_config_id` (to receive the node database and live packets)
 * and periodic heartbeats. It never changes the radio's settings or channels and never reads
 * keys out of it.
 */
export class WebSerialRadio {
  private port: SerialPortLike | null = null;
  /** Kept after a disconnect so a reconnect needs no port picker. */
  private lastPort: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private reading: Promise<void> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private readonly decoder = new FrameDecoder();
  /** Frames that were not valid `FromRadio` messages, shown in the radio panel. */
  undecodableFrames = 0;

  constructor(private readonly callbacks: RadioCallbacks) {
    serial()?.addEventListener("disconnect", this.onUnplugged);
  }

  get invalidFrames(): number {
    return this.decoder.invalidFrames;
  }

  /** Shows the browser's port picker; must run inside a click handler. */
  async connect(): Promise<void> {
    const api = serial();
    if (api === null) {
      this.callbacks.onStatus("idle", "This browser cannot connect USB radios.");
      return;
    }
    let port: SerialPortLike;
    try {
      port = await api.requestPort();
    } catch {
      return; // The operator closed the picker.
    }
    await this.open(port);
  }

  /** Reopens the last radio, or a port this site may already use, without the picker. */
  async reconnect(): Promise<void> {
    const port = this.lastPort ?? (await serial()?.getPorts())?.[0] ?? null;
    if (port === null) {
      await this.connect();
      return;
    }
    await this.open(port);
  }

  async disconnect(): Promise<void> {
    await this.release();
    this.callbacks.onStatus("idle", null);
  }

  dispose(): void {
    serial()?.removeEventListener("disconnect", this.onUnplugged);
    void this.release();
  }

  private readonly onUnplugged = (event: Event): void => {
    if (event.target === this.port) {
      void this.release().then(() => this.callbacks.onStatus("disconnected", "The radio was unplugged."));
    }
  };

  private async open(port: SerialPortLike): Promise<void> {
    await this.release();
    this.callbacks.onStatus("connecting", null);
    try {
      await port.open({ baudRate: BAUD_RATE });
    } catch (error: unknown) {
      this.callbacks.onStatus("disconnected", describeOpenError(error));
      return;
    }
    this.port = port;
    this.lastPort = port;
    this.decoder.reset();
    this.writer = port.writable?.getWriter() ?? null;
    this.reading = this.readLoop(port);
    try {
      // A burst of START2 bytes wakes the serial API before the first request, as the official clients do.
      await this.writer?.write(new Uint8Array(32).fill(START2));
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.send(encodeWantConfig(Math.floor(Math.random() * 0xffffffff)));
      this.heartbeat = setInterval(() => void this.send(encodeHeartbeat()).catch(() => undefined), HEARTBEAT_MS);
      this.callbacks.onStatus("connected", null);
    } catch {
      await this.release();
      this.callbacks.onStatus("disconnected", "The radio did not accept the connection request.");
    }
  }

  private async send(payload: Uint8Array): Promise<void> {
    await this.writer?.write(encodeFrame(payload));
  }

  private async readLoop(port: SerialPortLike): Promise<void> {
    const reader = port.readable?.getReader() ?? null;
    if (reader === null) {
      return;
    }
    this.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        for (const frame of this.decoder.push(value)) {
          this.handleFrame(frame);
        }
      }
    } catch (error: unknown) {
      // Device resets and unplugging end the stream with an error. Positions are never logged.
      logger.warn("Meshtastic serial read ended", { error: error instanceof Error ? error.name : "unknown" });
    } finally {
      reader.releaseLock();
      this.reader = null;
    }
    // Still the active port: the stream ended by itself, not through release().
    if (this.port === port) {
      this.reading = null;
      await this.release();
      this.callbacks.onStatus("disconnected", "The connection to the radio ended. It may have restarted.");
    }
  }

  private handleFrame(frame: Uint8Array): void {
    let event: RadioEvent | null;
    try {
      event = decodeFromRadio(frame);
    } catch {
      this.undecodableFrames += 1;
      return;
    }
    if (event !== null) {
      this.callbacks.onEvent(event);
    }
  }

  /** Stops reading, releases the stream locks and closes the port, in the order Web Serial requires. */
  private async release(): Promise<void> {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    const port = this.port;
    this.port = null;
    await this.reader?.cancel().catch(() => undefined);
    await this.reading;
    this.reading = null;
    this.writer?.releaseLock();
    this.writer = null;
    await port?.close().catch(() => undefined);
  }
}
