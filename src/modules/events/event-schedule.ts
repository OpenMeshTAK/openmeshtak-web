import type { EventDto } from "./events.api";

const DAY = 24 * 60 * 60_000;

/** A short note on where the event stands in time; the lifecycle status is shown separately. */
export function scheduleHint(event: Pick<EventDto, "startsAt" | "endsAt">, now = new Date()): string | null {
  const start = event.startsAt === null ? null : new Date(event.startsAt).getTime();
  const end = event.endsAt === null ? null : new Date(event.endsAt).getTime();
  const time = now.getTime();
  if (end !== null && end < time) {
    return "Ended";
  }
  if (start !== null && start > time) {
    const days = Math.ceil((start - time) / DAY);
    return days === 1 ? "Starts tomorrow" : `Starts in ${String(days)} days`;
  }
  return start !== null ? "Running" : null;
}
