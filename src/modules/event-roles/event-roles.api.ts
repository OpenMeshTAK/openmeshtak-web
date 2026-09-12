import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type EventRoleDto = Schemas["EventRoleDto"];

export async function listRoles(eventId: string): Promise<EventRoleDto[]> {
  const page = await unwrap(
    api.GET("/events/{eventId}/roles", { params: { path: { eventId }, query: { limit: 100 } } }),
  );
  return page.items;
}

export function createRole(eventId: string, body: Schemas["CreateEventRoleRequest"]): Promise<EventRoleDto> {
  return unwrap(api.POST("/events/{eventId}/roles", { params: { path: { eventId } }, body }));
}

export function updateRole(
  eventId: string,
  roleId: string,
  body: Schemas["UpdateEventRoleRequest"],
): Promise<EventRoleDto> {
  return unwrap(api.PUT("/events/{eventId}/roles/{roleId}", { params: { path: { eventId, roleId } }, body }));
}

export async function deleteRole(eventId: string, roleId: string): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/roles/{roleId}", { params: { path: { eventId, roleId } } }));
}
