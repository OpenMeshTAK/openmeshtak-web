import type { Permission } from "./types";

type Exhaustive<Listed extends readonly Permission[]> =
  Exclude<Permission, Listed[number]> extends never ? Listed : never;

const permissions = [
  "users.read",
  "users.manage",
  "user-groups.read",
  "user-groups.manage",
  "events.read",
  "events.manage",
  "events.reactivate",
  "members.read",
  "members.manage",
  "members.sync",
  "member-claims.create",
  "missions.read",
  "missions.edit",
  "missions.publish",
  "artifacts.generate",
  "artifacts.download",
  "service-accounts.manage",
  "audit.read",
] as const;

/** Core's permission catalog for pickers; the list fails to compile when Core adds a permission. */
export const permissionCatalog: Exhaustive<typeof permissions> = permissions;
