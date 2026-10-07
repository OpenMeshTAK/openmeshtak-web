import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type UserDto = Schemas["UserDto"];

/** One page of users, optionally filtered by part of the name or email. */
export function searchUsers(search: string, cursor: string | null): Promise<Schemas["UserPage"]> {
  const query = { limit: 50, ...(search.trim() === "" ? {} : { search: search.trim() }), ...(cursor === null ? {} : { cursor }) };
  return unwrap(api.GET("/users", { params: { query } }));
}

/** Saves the display name and, for users with a local login, the username. */
export function updateUser(user: UserDto, displayName: string, username: string | null): Promise<UserDto> {
  const body = { version: user.version, displayName, ...(username === null ? {} : { username }) };
  return unwrap(api.PUT("/users/{userId}", { params: { path: { userId: user.id } }, body }));
}

export function setUserDisabled(userId: string, disabled: boolean): Promise<UserDto> {
  return disabled
    ? unwrap(api.POST("/users/{userId}/disable", { params: { path: { userId } } }))
    : unwrap(api.POST("/users/{userId}/enable", { params: { path: { userId } } }));
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await unwrap(api.POST("/users/{userId}/revoke-sessions", { params: { path: { userId } } }));
}

/** Core emails a reset link only to a verified address; the response is the same either way. */
export async function sendPasswordReset(userId: string): Promise<void> {
  await unwrap(api.POST("/users/{userId}/password-reset", { params: { path: { userId } } }));
}

export type SetupLinkDto = Schemas["SetupLinkDto"];

/** Creates a user without a password; the returned single-use link lets them set one. */
export function createUser(displayName: string, username: string | null): Promise<Schemas["CreatedUserResponse"]> {
  const body = { displayName, ...(username === null ? {} : { username }) };
  return unwrap(api.POST("/users", { body }));
}

/** A fresh setup link for a user without a password; earlier links stop working. */
export function createSetupLink(userId: string): Promise<SetupLinkDto> {
  return unwrap(api.POST("/users/{userId}/setup-link", { params: { path: { userId } } }));
}
