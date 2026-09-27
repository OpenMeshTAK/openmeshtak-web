import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type EventMemberDto = Schemas["EventMemberDto"];
export type SyncIssueDto = Schemas["SyncIssueDto"];
export type SyncResult = Schemas["ExternalMemberSyncResult"];

export async function listMembers(eventId: string): Promise<EventMemberDto[]> {
  const members: EventMemberDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      api.GET("/events/{eventId}/members", {
        params: { path: { eventId }, query: { limit: 100, ...(cursor ? { cursor } : {}) } },
      }),
    );
    members.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return members;
}

/** Adds an existing OpenMeshTak user; external identities use `syncMember` instead. */
export function createMember(eventId: string, body: Schemas["CreateEventMemberRequest"]): Promise<EventMemberDto> {
  return unwrap(api.POST("/events/{eventId}/members", { params: { path: { eventId } }, body }));
}

export function updateMember(
  eventId: string,
  memberId: string,
  body: Schemas["UpdateEventMemberRequest"],
): Promise<EventMemberDto> {
  return unwrap(api.PUT("/events/{eventId}/members/{memberId}", { params: { path: { eventId, memberId } }, body }));
}

export async function removeMember(eventId: string, memberId: string): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/members/{memberId}", { params: { path: { eventId, memberId } } }));
}

/** Idempotent external-identity upsert, the same call integrations use. */
export function syncMember(
  eventId: string,
  provider: string,
  externalId: string,
  body: Schemas["ExternalMemberSyncRequest"],
): Promise<SyncResult> {
  return unwrap(
    api.PUT("/events/{eventId}/external-members/{provider}/{externalId}", {
      params: { path: { eventId, provider, externalId } },
      body,
    }),
  );
}

export function fetchProfile(eventId: string, memberId: string): Promise<Schemas["ResolvedProfileDto"]> {
  return unwrap(
    api.GET("/events/{eventId}/members/{memberId}/profile", { params: { path: { eventId, memberId } } }),
  );
}

export async function listOpenSyncIssues(eventId: string): Promise<SyncIssueDto[]> {
  const page = await unwrap(
    api.GET("/events/{eventId}/sync-issues", {
      params: { path: { eventId }, query: { status: "open", limit: 100 } },
    }),
  );
  return page.items;
}

export function retrySyncIssue(eventId: string, syncIssueId: string, callsignOverride?: string): Promise<SyncResult> {
  return unwrap(
    api.POST("/events/{eventId}/sync-issues/{syncIssueId}/retry", {
      params: { path: { eventId, syncIssueId } },
      body: callsignOverride ? { callsignOverride } : {},
    }),
  );
}

export function createClaim(eventId: string, memberId: string): Promise<Schemas["CreatedMemberClaimResponse"]> {
  return unwrap(
    api.POST("/events/{eventId}/members/{memberId}/claims", { params: { path: { eventId, memberId } } }),
  );
}

/** Core renumbers the group's short names 1..n in this order; send every current member once. */
export function reorderGroupMembers(eventId: string, groupId: string, memberIds: string[]): Promise<EventMemberDto[]> {
  return unwrap(
    api.PUT("/events/{eventId}/groups/{groupId}/member-order", { params: { path: { eventId, groupId } }, body: { memberIds } }),
  );
}

/** The number part of a short name such as `B12`; members without one sort last. */
export function shortNameNumber(member: EventMemberDto): number {
  const digits = /\d+$/.exec(member.shortName ?? "")?.[0];
  return digits === undefined ? Number.MAX_SAFE_INTEGER : Number(digits);
}
