import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export function fetchMyMemberships(): Promise<Schemas["MyEventMembershipDto"][]> {
  return unwrap(api.GET("/me/event-memberships"));
}

export function fetchProfile(eventId: string, memberId: string): Promise<Schemas["ResolvedProfileDto"]> {
  return unwrap(
    api.GET("/events/{eventId}/members/{memberId}/profile", { params: { path: { eventId, memberId } } }),
  );
}
