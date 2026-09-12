import type { Permission } from "./types";

export interface PermissionEntry {
  permission: Permission;
  label: string;
  /**
   * Display hint mirroring Core's rule that installation administration cannot be limited to one
   * event. The editor disables these rows inside event blocks; Core still rejects invalid grants.
   */
  instanceOnly?: true;
}

export interface PermissionArea {
  label: string;
  /** Technical prefix shown next to the area checkbox, e.g. `events.*`. */
  prefix: string;
  permissions: PermissionEntry[];
}

/** Core's permission catalog grouped for people. */
export const permissionAreas: PermissionArea[] = [
  {
    label: "Users",
    prefix: "users.*",
    permissions: [
      { permission: "users.read", label: "View users", instanceOnly: true },
      { permission: "users.manage", label: "Manage users", instanceOnly: true },
    ],
  },
  {
    label: "User groups",
    prefix: "user-groups.*",
    permissions: [
      { permission: "user-groups.read", label: "View user groups", instanceOnly: true },
      { permission: "user-groups.manage", label: "Manage user groups and permissions", instanceOnly: true },
    ],
  },
  {
    label: "Events",
    prefix: "events.*",
    permissions: [
      { permission: "events.read", label: "View events" },
      { permission: "events.manage", label: "Create and edit events" },
      { permission: "events.reactivate", label: "Reactivate archived events" },
    ],
  },
  {
    label: "Members",
    prefix: "members.*",
    permissions: [
      { permission: "members.read", label: "View members and profiles" },
      { permission: "members.manage", label: "Manage members and sync issues" },
      { permission: "members.sync", label: "Synchronize members" },
      { permission: "member-claims.create", label: "Create access links" },
    ],
  },
  {
    label: "Missions",
    prefix: "missions.*",
    permissions: [
      { permission: "missions.read", label: "View missions" },
      { permission: "missions.edit", label: "Edit missions" },
      { permission: "missions.publish", label: "Publish mission packages" },
    ],
  },
  {
    label: "Device setup",
    prefix: "artifacts.*",
    permissions: [
      { permission: "artifacts.generate", label: "Generate setup files" },
      { permission: "artifacts.download", label: "Download setup files" },
    ],
  },
  {
    label: "Service accounts",
    prefix: "service-accounts.*",
    permissions: [
      { permission: "service-accounts.manage", label: "Manage service accounts and API keys", instanceOnly: true },
    ],
  },
  {
    label: "Audit",
    prefix: "audit.*",
    permissions: [{ permission: "audit.read", label: "Read the audit log", instanceOnly: true }],
  },
];

type Listed = (typeof permissionAreas)[number]["permissions"][number]["permission"];

/** Compile-time guard: fails when Core adds a permission that no area lists yet. */
export const catalogIsComplete: Exclude<Permission, Listed> extends never ? true : never = true;
