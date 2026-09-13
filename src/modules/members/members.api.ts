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

/** Members enter an event only through the idempotent external-identity upsert. */
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
