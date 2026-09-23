import { api, unwrap } from "@/shared/api/client";
import { ApiProblem } from "@/shared/errors/api-problem";
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

export function fetchMemberDataPackages(eventId: string, memberId: string): Promise<Schemas["MemberDataPackageDto"][]> {
  return unwrap(
    api.GET("/events/{eventId}/members/{memberId}/data-packages", { params: { path: { eventId, memberId } } }),
  );
}

/**
 * Plain same-origin link so the browser downloads with the session cookie and the server's file
 * name; Core authorizes and audits every download.
 */
export function memberDataPackageUrl(eventId: string, memberId: string, packageId: string): string {
  return `/api/v1/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(memberId)}/data-packages/${encodeURIComponent(packageId)}/atak`;
}

/**
 * Fetches the member's Meshtastic device profile (`.cfg`). Core audits every download, also when
 * an operator downloads it on the member's behalf. The file contains channel keys, so it is
 * handed straight to the save dialog and never kept in application state.
 */
export async function downloadDeviceProfile(eventId: string, memberId: string): Promise<{ blob: Blob; fileName: string }> {
  const path = `/api/v1/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(memberId)}/meshtastic/device-profile`;
  const response = await fetch(new URL(path, window.location.origin).href, { credentials: "same-origin" });
  if (!response.ok) {
    throw new ApiProblem(response.status, await response.json().catch(() => ({})));
  }
  const fileName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "meshtastic.cfg";
  return { blob: await response.blob(), fileName };
}
