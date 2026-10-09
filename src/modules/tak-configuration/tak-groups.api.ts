import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type TakGroupSummaryDto = Schemas["TakGroupSummaryDto"];
export type TakGroupDto = Schemas["TakGroupDto"];
export type TakGroupMemberDto = Schemas["TakGroupMemberDto"];

export async function listTakGroups(eventId: string): Promise<TakGroupSummaryDto[]> {
  const groups: TakGroupSummaryDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      api.GET("/events/{eventId}/tak/groups", { params: { path: { eventId }, query: { limit: 100, ...(cursor ? { cursor } : {}) } } }),
    );
    groups.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return groups;
}

export function getTakGroup(eventId: string, groupId: string): Promise<TakGroupDto> {
  return unwrap(api.GET("/events/{eventId}/tak/groups/{groupId}", { params: { path: { eventId, groupId } } }));
}

export function createTakGroup(eventId: string, body: Schemas["CreateTakGroupRequest"]): Promise<TakGroupDto> {
  return unwrap(api.POST("/events/{eventId}/tak/groups", { params: { path: { eventId } }, body }));
}

export function updateTakGroup(eventId: string, groupId: string, body: Schemas["UpdateTakGroupRequest"]): Promise<TakGroupDto> {
  return unwrap(api.PUT("/events/{eventId}/tak/groups/{groupId}", { params: { path: { eventId, groupId } }, body }));
}

export async function deleteTakGroup(eventId: string, groupId: string): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/tak/groups/{groupId}", { params: { path: { eventId, groupId } } }));
}
