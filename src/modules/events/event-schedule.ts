import type { EventDto } from "./events.api";

const DAY = 24 * 60 * 60_000;

/** Dates are shown in the event's own time zone, so organizers everywhere see the same days. */
export function formatEventDates(event: Pick<EventDto, "startsAt" | "endsAt" | "timeZone">): string | null {
  const format = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: event.timeZone });
  const start = event.startsAt === null ? null : new Date(event.startsAt);
  const end = event.endsAt === null ? null : new Date(event.endsAt);
  if (start !== null && end !== null) {
    return format.formatRange(start, end);
  }
  if (start !== null) {
    return `From ${format.format(start)}`;
  }
  return end === null ? null : `Until ${format.format(end)}`;
}

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

const STATUS_ORDER: Record<EventDto["status"], number> = { active: 0, draft: 1, archived: 2 };

/** Active events first, then drafts, then archived ones; each group by start, undated last. */
export function compareEvents(a: EventDto, b: EventDto): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) {
    return byStatus;
  }
  const startA = a.startsAt === null ? Number.POSITIVE_INFINITY : new Date(a.startsAt).getTime();
  const startB = b.startsAt === null ? Number.POSITIVE_INFINITY : new Date(b.startsAt).getTime();
  return startA - startB || a.name.localeCompare(b.name);
}
