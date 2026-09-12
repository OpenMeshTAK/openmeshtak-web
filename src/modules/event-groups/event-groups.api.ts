import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type EventGroupDto = Schemas["EventGroupDto"];
export type GroupProvisioning = Schemas["GroupProvisioning"];

export async function listGroups(eventId: string): Promise<EventGroupDto[]> {
  const page = await unwrap(
    api.GET("/events/{eventId}/groups", { params: { path: { eventId }, query: { limit: 100 } } }),
  );
  return page.items;
}

export function createGroup(eventId: string, body: Schemas["CreateEventGroupRequest"]): Promise<EventGroupDto> {
  return unwrap(api.POST("/events/{eventId}/groups", { params: { path: { eventId } }, body }));
}

export function updateGroup(
  eventId: string,
  groupId: string,
  body: Schemas["UpdateEventGroupRequest"],
): Promise<EventGroupDto> {
  return unwrap(api.PUT("/events/{eventId}/groups/{groupId}", { params: { path: { eventId, groupId } }, body }));
}

export async function deleteGroup(eventId: string, groupId: string): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/groups/{groupId}", { params: { path: { eventId, groupId } } }));
}
