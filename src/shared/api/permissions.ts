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
      { permission: "events.manage", label: "Create events and edit their details" },
      { permission: "events.reactivate", label: "Reactivate archived events" },
      { permission: "event-groups.manage", label: "Edit event groups" },
      { permission: "event-roles.manage", label: "Edit event roles" },
      { permission: "configuration.publish", label: "Publish configuration changes to participants" },
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
    label: "TAK",
    prefix: "tak-*",
    permissions: [
      { permission: "tak-settings.manage", label: "Edit TAK settings and ATAK preferences" },
      { permission: "tak-groups.manage", label: "Edit TAK groups" },
    ],
  },
  {
    label: "TAK traffic",
    prefix: "tak-traffic.*",
    permissions: [
      { permission: "tak-traffic.view", label: "Watch live TAK traffic" },
      { permission: "tak-traffic.history", label: "View recorded track history" },
      { permission: "tak-traffic.export", label: "Export recorded tracks" },
      { permission: "tak-traffic.recording", label: "Turn recording on or off and set the retention" },
      { permission: "tak-traffic.delete", label: "Delete recorded traffic" },
    ],
  },
  {
    label: "Meshtastic",
    prefix: "meshtastic-*",
    permissions: [
      { permission: "meshtastic-settings.manage", label: "Edit radio settings and firmware" },
      { permission: "meshtastic-channels.manage", label: "Edit channels" },
      { permission: "channel-keys.reveal", label: "Reveal channel keys" },
    ],
  },
  {
    label: "Settings presets",
    prefix: "presets.*",
    permissions: [
      { permission: "presets.read", label: "View the preset library", instanceOnly: true },
      { permission: "presets.manage", label: "Add, edit and delete library presets", instanceOnly: true },
    ],
  },
  {
    label: "Data Packages",
    prefix: "data-packages.*",
    permissions: [
      { permission: "data-packages.read", label: "View Data Packages" },
      { permission: "data-packages.edit", label: "Edit Data Packages" },
      { permission: "data-packages.publish", label: "Publish Data Packages" },
      { permission: "offline-snapshots.prepare", label: "Make published content available offline" },
    ],
  },
  {
    label: "Missions",
    prefix: "missions.*",
    permissions: [
      { permission: "missions.read", label: "View missions" },
      { permission: "missions.edit", label: "Edit missions" },
      { permission: "missions.publish", label: "Sync missions and choose their audience and writers" },
    ],
  },
  {
    label: "Device setup",
    prefix: "artifacts.*",
    permissions: [
      { permission: "artifacts.generate", label: "Generate setup files" },
      { permission: "artifacts.download", label: "Download setup files" },
      { permission: "member-artifacts.download", label: "Set up devices for members" },
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
  {
    label: "Server log",
    prefix: "server-logs.*",
    permissions: [{ permission: "server-logs.read", label: "Watch the live server log", instanceOnly: true }],
  },
];

type Listed = (typeof permissionAreas)[number]["permissions"][number]["permission"];

/** Compile-time guard: fails when Core adds a permission that no area lists yet. */
export const catalogIsComplete: Exclude<Permission, Listed> extends never ? true : never = true;
