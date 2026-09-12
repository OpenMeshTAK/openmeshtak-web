import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type EventDto = Schemas["EventDto"];
export type EventTransition = "activate" | "archive" | "reactivate";

export async function listAllEvents(): Promise<EventDto[]> {
  const events: EventDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(api.GET("/events", { params: { query: { limit: 100, ...(cursor ? { cursor } : {}) } } }));
    events.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return events;
}

export function getEvent(eventId: string): Promise<EventDto> {
  return unwrap(api.GET("/events/{eventId}", { params: { path: { eventId } } }));
}

export function createEvent(body: Schemas["CreateEventRequest"]): Promise<EventDto> {
  return unwrap(api.POST("/events", { body }));
}

export function updateEvent(eventId: string, body: Schemas["UpdateEventRequest"]): Promise<EventDto> {
  return unwrap(api.PUT("/events/{eventId}", { params: { path: { eventId } }, body }));
}

export function transitionEvent(eventId: string, transition: EventTransition, version: number): Promise<EventDto> {
  const path = `/events/{eventId}/${transition}` as const;
  return unwrap(api.POST(path, { params: { path: { eventId } }, body: { version } }));
}

export function publishConfiguration(eventId: string): Promise<Schemas["PublishConfigurationResponse"]> {
  return unwrap(api.POST("/events/{eventId}/configuration-revisions", { params: { path: { eventId } } }));
}
