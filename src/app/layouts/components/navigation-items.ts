import { mdiAccount, mdiAccountGroup, mdiCalendarMultiple, mdiCogOutline, mdiKeyChain, mdiViewDashboard } from "@mdi/js";
import type { Permission } from "@/shared/api/types";
import { settingsPermissions } from "@/modules/settings/settings-sections";

export interface NavigationItem {
  title: string;
  icon: string;
  to: string;
  /** Hint only; Core authorizes every request behind these pages. A list means any of them. */
  permission?: Permission | Permission[];
}

export const navigationItems: NavigationItem[] = [
  { title: "Dashboard", icon: mdiViewDashboard, to: "/" },
  { title: "Events", icon: mdiCalendarMultiple, to: "/admin/events", permission: "events.read" },
  { title: "Users", icon: mdiAccount, to: "/admin/users", permission: "users.read" },
  { title: "User groups", icon: mdiAccountGroup, to: "/admin/user-groups", permission: "user-groups.read" },
  { title: "Service accounts", icon: mdiKeyChain, to: "/admin/service-accounts", permission: "service-accounts.manage" },
  { title: "Settings", icon: mdiCogOutline, to: "/admin/settings", permission: settingsPermissions },
];
