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
      { permission: "users.create", label: "Create permanent users", instanceOnly: true },
      { permission: "users.edit", label: "Rename users and change usernames", instanceOnly: true },
      { permission: "users.set-email", label: "Set email addresses", instanceOnly: true },
      { permission: "users.disable", label: "Disable and enable users", instanceOnly: true },
      { permission: "users.sign-out", label: "Sign users out everywhere", instanceOnly: true },
      { permission: "users.password-reset", label: "Send password reset emails", instanceOnly: true },
      { permission: "users.setup-links", label: "Create setup links", instanceOnly: true },
      { permission: "registration.manage", label: "Manage self-registration and invites", instanceOnly: true },
    ],
  },
  {
    label: "User groups",
    prefix: "user-groups.*",
    permissions: [
      { permission: "user-groups.read", label: "View user groups", instanceOnly: true },
      { permission: "user-groups.manage", label: "Create, edit and delete user groups and their permissions", instanceOnly: true },
      { permission: "user-group-members.manage", label: "Add and remove group members", instanceOnly: true },
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
      { permission: "member-accounts.create", label: "Create new people as members" },
      { permission: "event-accounts.manage", label: "Keep event accounts as permanent users" },
      { permission: "member-claims.create", label: "Create access links" },
    ],
  },
  {
    label: "Meshtastic",
    prefix: "channel-keys.*",
    permissions: [{ permission: "channel-keys.reveal", label: "Reveal channel keys" }],
  },
  {
    label: "Missions",
    prefix: "dataPackages.*",
    permissions: [
      { permission: "data-packages.read", label: "View data packages" },
      { permission: "data-packages.edit", label: "Edit data packages" },
      { permission: "data-packages.publish", label: "Publish data packages" },
    ],
  },
  {
    label: "Device setup",
    prefix: "artifacts.*",
    permissions: [
      { permission: "artifacts.generate", label: "Generate setup files" },
      { permission: "artifacts.download", label: "Download setup files" },
      { permission: "member-artifacts.download", label: "Set up devices for members" },
      { permission: "tak-traffic.view", label: "Watch live TAK traffic" },
    ],
  },
  {
    label: "API clients",
    prefix: "api-clients.*",
    permissions: [
      { permission: "api-clients.manage", label: "Manage API clients and API keys", instanceOnly: true },
    ],
  },
  {
    label: "TAK server",
    prefix: "tak-server.*",
    permissions: [
      { permission: "tak-server.manage", label: "Manage the TAK server and its certificates", instanceOnly: true },
      { permission: "tak-server.admin-access", label: "Use the TAK server with access to every event", instanceOnly: true },
    ],
  },
  {
    label: "Email",
    prefix: "email.*",
    permissions: [{ permission: "email.manage", label: "Manage email delivery", instanceOnly: true }],
  },
  {
    label: "Settings",
    prefix: "settings.*",
    permissions: [{ permission: "settings.manage", label: "Manage installation settings such as the base map", instanceOnly: true }],
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
