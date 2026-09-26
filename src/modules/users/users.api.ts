import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type UserDto = Schemas["UserDto"];

/** One page of users, optionally filtered by part of the name or email. */
export function searchUsers(search: string, cursor: string | null): Promise<Schemas["UserPage"]> {
  const query = { limit: 50, ...(search.trim() === "" ? {} : { search: search.trim() }), ...(cursor === null ? {} : { cursor }) };
  return unwrap(api.GET("/users", { params: { query } }));
}

export function renameUser(user: UserDto, displayName: string): Promise<UserDto> {
  return unwrap(api.PUT("/users/{userId}", { params: { path: { userId: user.id } }, body: { version: user.version, displayName } }));
}

export function setUserDisabled(userId: string, disabled: boolean): Promise<UserDto> {
  return disabled
    ? unwrap(api.POST("/users/{userId}/disable", { params: { path: { userId } } }))
    : unwrap(api.POST("/users/{userId}/enable", { params: { path: { userId } } }));
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await unwrap(api.POST("/users/{userId}/revoke-sessions", { params: { path: { userId } } }));
}
