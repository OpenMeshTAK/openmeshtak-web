import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type UserDto = Schemas["UserDto"];
export type UserAccountType = Schemas["UserAccountType"];

/** One page of users, optionally filtered by part of the name or email and by account type. */
export function searchUsers(
  search: string,
  cursor: string | null,
  accountType: UserAccountType | null = null,
): Promise<Schemas["UserPage"]> {
  const query = {
    limit: 50,
    ...(search.trim() === "" ? {} : { search: search.trim() }),
    ...(cursor === null ? {} : { cursor }),
    ...(accountType === null ? {} : { accountType }),
  };
  return unwrap(api.GET("/users", { params: { query } }));
}

/** Every event account of one event, e.g. to show what archiving it deletes. */
export async function listEventAccounts(eventId: string): Promise<UserDto[]> {
  const accounts: UserDto[] = [];
  let cursor: string | null = null;
  do {
    const page: Schemas["UserPage"] = await searchUsers("", cursor, "event");
    accounts.push(...page.items.filter((user) => user.accountEvent?.id === eventId));
    cursor = page.page.nextCursor ?? null;
  } while (cursor !== null);
  return accounts;
}

/** Keeps an event account when its event is archived. */
export function makeUserPermanent(userId: string): Promise<UserDto> {
  return unwrap(api.POST("/users/{userId}/make-permanent", { params: { path: { userId } } }));
}

/** Turns all current event accounts of an event into permanent users; returns how many. */
export async function makeEventAccountsPermanent(eventId: string): Promise<number> {
  const result = await unwrap(api.POST("/events/{eventId}/make-accounts-permanent", { params: { path: { eventId } } }));
  return result.accounts;
}

/**
 * Saves the display name and, for users with a local login, the username and email address.
 * `email` left out keeps the address; `null` removes it.
 */
export function updateUser(
  user: UserDto,
  displayName: string,
  username: string | null,
  email?: string | null,
): Promise<UserDto> {
  const body = {
    version: user.version,
    displayName,
    ...(username === null ? {} : { username }),
    ...(email === undefined ? {} : { email }),
  };
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

export function getUser(userId: string): Promise<UserDto> {
  return unwrap(api.GET("/users/{userId}", { params: { path: { userId } } }));
}
