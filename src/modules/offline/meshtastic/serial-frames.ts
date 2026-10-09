/**
 * Meshtastic stream framing for serial connections, as documented for the client API
 * (https://meshtastic.org/docs/development/device/client-api/#streaming-version): each protobuf
 * is preceded by `0x94 0xC3` and a 16-bit big-endian length. Anything between frames is the
 * radio's plain-text debug log and is ignored. Lengths above 512 bytes are invalid; the decoder
 * then searches for the next start marker instead of trusting the corrupted header.
 */
export const START1 = 0x94;
export const START2 = 0xc3;
export const MAX_PAYLOAD = 512;
const HEADER = 4;

export class FrameDecoder {
  private buffer = new Uint8Array(0);
  /** Frames dropped because of an invalid length, for the radio status display. */
  invalidFrames = 0;

  /** Adds received bytes and returns every complete protobuf payload in arrival order. */
  push(chunk: Uint8Array): Uint8Array[] {
    const joined = new Uint8Array(this.buffer.length + chunk.length);
    joined.set(this.buffer);
    joined.set(chunk, this.buffer.length);
    this.buffer = joined;

    const frames: Uint8Array[] = [];
    let offset = 0;
    while (offset < this.buffer.length) {
      const start = this.findStart(offset);
      if (start === -1) {
        // Keep a trailing START1, it may be the first half of the next marker.
        offset = this.buffer.at(-1) === START1 ? this.buffer.length - 1 : this.buffer.length;
        break;
      }
      if (this.buffer.length - start < HEADER) {
        offset = start;
        break;
      }
      const length = (this.buffer[start + 2]! << 8) | this.buffer[start + 3]!;
      if (length > MAX_PAYLOAD) {
        this.invalidFrames += 1;
        offset = start + 1;
        continue;
      }
      if (this.buffer.length - start < HEADER + length) {
        offset = start;
        break;
      }
      frames.push(this.buffer.slice(start + HEADER, start + HEADER + length));
      offset = start + HEADER + length;
    }
    this.buffer = this.buffer.slice(offset);
    return frames;
  }

  /** Drops any partial frame, e.g. after the port was reopened. */
  reset(): void {
    this.buffer = new Uint8Array(0);
  }

  private findStart(from: number): number {
    for (let index = from; index < this.buffer.length - 1; index += 1) {
      if (this.buffer[index] === START1 && this.buffer[index + 1] === START2) {
        return index;
      }
    }
    return -1;
  }
}

/** Wraps one encoded `ToRadio` protobuf for sending. */
export function encodeFrame(payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_PAYLOAD) {
    throw new Error("Meshtastic frames carry at most 512 bytes.");
  }
  const frame = new Uint8Array(HEADER + payload.length);
  frame.set([START1, START2, payload.length >> 8, payload.length & 0xff]);
  frame.set(payload, HEADER);
  return frame;
}
