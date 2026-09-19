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

/** Core audits this secret-bearing response; keep it only in the active handout dialog. */
export function fetchChannelHandout(
  eventId: string,
  memberId: string,
  channelId: string,
): Promise<Schemas["ChannelHandoutDto"]> {
  return unwrap(
    api.GET("/events/{eventId}/members/{memberId}/meshtastic/channels/{channelId}/handout", {
      params: { path: { eventId, memberId, channelId } },
    }),
  );
}
