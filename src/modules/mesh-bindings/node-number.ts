/**
 * Reads a Meshtastic node number as operators see it: `!a1b2c3d4` (the node ID in the apps),
 * eight hexadecimal digits with at least one letter, or decimal. Returns null for anything that is not a valid node
 * number (1 to 0xfffffffe; 0 and 0xffffffff are reserved for "nobody" and broadcast).
 */
export function parseNodeNumber(input: string): number | null {
  const text = input.trim().toLowerCase();
  let value: number;
  if (/^![0-9a-f]{8}$/.test(text) || (/^[0-9a-f]{8}$/.test(text) && /[a-f]/.test(text))) {
    value = Number.parseInt(text.replace("!", ""), 16);
  } else if (/^\d{1,10}$/.test(text)) {
    value = Number(text);
  } else {
    return null;
  }
  return value >= 1 && value <= 0xffff_fffe ? value : null;
}

export function nodeIdOf(nodeNum: number): string {
  return `!${(nodeNum >>> 0).toString(16).padStart(8, "0")}`;
}
