import { mdiEmailOutline, mdiLayersOutline, mdiServerNetwork } from "@mdi/js";
import type { Permission } from "@/shared/api/types";

export interface SettingsSection {
  /** Route name of the section below `/admin/settings`. */
  name: string;
  title: string;
  icon: string;
  /** Hint only; Core authorizes every request behind these sections. */
  permission: Permission;
}

/** Instance-wide settings, in the order of the Settings side menu. */
export const settingsSections: SettingsSection[] = [
  { name: "email-settings", title: "Email", icon: mdiEmailOutline, permission: "email.manage" },
  { name: "base-map", title: "Base map", icon: mdiLayersOutline, permission: "settings.manage" },
  { name: "tak-server", title: "TAK server", icon: mdiServerNetwork, permission: "tak-server.manage" },
];

/** The permissions that make the Settings page reachable at all. */
export const settingsPermissions: Permission[] = settingsSections.map((section) => section.permission);
