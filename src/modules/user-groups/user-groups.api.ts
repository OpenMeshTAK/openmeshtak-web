import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type UserGroupDto = Schemas["UserGroupDto"];
export type UserDto = Schemas["UserDto"];

export async function listUserGroups(): Promise<UserGroupDto[]> {
  const page = await unwrap(api.GET("/user-groups", { params: { query: { limit: 100 } } }));
  return page.items;
}

export function getUserGroup(userGroupId: string): Promise<UserGroupDto> {
  return unwrap(api.GET("/user-groups/{userGroupId}", { params: { path: { userGroupId } } }));
}

export function createUserGroup(body: Schemas["CreateUserGroupRequest"]): Promise<UserGroupDto> {
  return unwrap(api.POST("/user-groups", { body }));
}

export function updateUserGroup(userGroupId: string, body: Schemas["UpdateUserGroupRequest"]): Promise<UserGroupDto> {
  return unwrap(api.PUT("/user-groups/{userGroupId}", { params: { path: { userGroupId } }, body }));
}

export async function deleteUserGroup(userGroupId: string): Promise<void> {
  await unwrap(api.DELETE("/user-groups/{userGroupId}", { params: { path: { userGroupId } } }));
}

export async function listGroupMembers(userGroupId: string): Promise<UserDto[]> {
  const page = await unwrap(
    api.GET("/user-groups/{userGroupId}/members", { params: { path: { userGroupId }, query: { limit: 100 } } }),
  );
  return page.items;
}

export async function addGroupMember(userGroupId: string, userId: string): Promise<void> {
  await unwrap(
    api.PUT("/user-groups/{userGroupId}/members/{userId}", { params: { path: { userGroupId, userId } } }),
  );
}

export async function removeGroupMember(userGroupId: string, userId: string): Promise<void> {
  await unwrap(
    api.DELETE("/user-groups/{userGroupId}/members/{userId}", { params: { path: { userGroupId, userId } } }),
  );
}

export async function listAllUsers(): Promise<UserDto[]> {
  const users: UserDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(api.GET("/users", { params: { query: { limit: 100, ...(cursor ? { cursor } : {}) } } }));
    users.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return users;
}
