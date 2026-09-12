import type { EventSettings } from "./components/EventSettingsForm.vue";
import type { EventDto } from "./events.api";

/** Converts between API instants and `datetime-local` values in the browser's local time. */
function toLocalInput(instant: string | null): string {
  if (instant === null) {
    return "";
  }
  const date = new Date(instant);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toInstant(localValue: string): string | null {
  return localValue === "" ? null : new Date(localValue).toISOString();
}

export function emptySettings(): EventSettings {
  return {
    name: "",
    slug: "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    startsAt: "",
    endsAt: "",
  };
}

export function settingsFromEvent(event: EventDto): EventSettings {
  return {
    name: event.name,
    slug: event.slug,
    timeZone: event.timeZone,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
  };
}

export function settingsToRequest(settings: EventSettings) {
  return {
    name: settings.name,
    slug: settings.slug,
    timeZone: settings.timeZone,
    startsAt: toInstant(settings.startsAt),
    endsAt: toInstant(settings.endsAt),
  };
}
