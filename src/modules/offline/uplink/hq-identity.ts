import type { HqIdentity } from "./mesh-uplink.api";

/**
 * Per-browser HQ settings. The HQ ID is a random UUID created once per browser profile, so Core
 * and viewers can tell several HQ PCs apart; it identifies nothing else. Storage may be
 * unavailable (private windows, blocked site data), so every access is guarded.
 */
const HQ_KEY = "openmeshtak.hq";
const uplinkKey = (eventId: string): string => `openmeshtak.uplink.${eventId}`;
export const HQ_NAME_MAX = 60;

function isHqIdentity(value: unknown): value is HqIdentity {
  return typeof value === "object" && value !== null
    && typeof (value as HqIdentity).id === "string" && /^[0-9a-f-]{36}$/i.test((value as HqIdentity).id)
    && typeof (value as HqIdentity).name === "string";
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Without storage the setting lasts for this page view.
  }
}

/** The stored HQ identity, created on first use. */
export function readHqIdentity(): HqIdentity {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(HQ_KEY) ?? "null");
    if (isHqIdentity(stored)) return { id: stored.id, name: stored.name.slice(0, HQ_NAME_MAX) };
  } catch {
    // Unreadable or unavailable storage: start a new identity below.
  }
  const created = { id: crypto.randomUUID(), name: "" };
  store(HQ_KEY, JSON.stringify(created));
  return created;
}

export function storeHqName(identity: HqIdentity, name: string): HqIdentity {
  const next = { id: identity.id, name: name.slice(0, HQ_NAME_MAX) };
  store(HQ_KEY, JSON.stringify(next));
  return next;
}

/** Whether the operator switched the uplink on for this event in this browser. */
export function readUplinkEnabled(eventId: string): boolean {
  try {
    return window.localStorage.getItem(uplinkKey(eventId)) === "on";
  } catch {
    return false;
  }
}

export function storeUplinkEnabled(eventId: string, enabled: boolean): void {
  store(uplinkKey(eventId), enabled ? "on" : null);
}
