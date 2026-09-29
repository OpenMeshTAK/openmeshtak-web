import { mdiAccount, mdiAccountGroup, mdiCalendarMultiple, mdiEmailOutline, mdiLayersOutline, mdiKeyChain, mdiServerNetwork, mdiViewDashboard } from "@mdi/js";
import type { Permission } from "@/shared/api/types";

export interface NavigationItem {
  title: string;
  icon: string;
  to: string;
  /** Hint only; Core authorizes every request behind these pages. */
  permission?: Permission;
}

export const navigationItems: NavigationItem[] = [
  { title: "Dashboard", icon: mdiViewDashboard, to: "/" },
  { title: "Events", icon: mdiCalendarMultiple, to: "/admin/events", permission: "events.read" },
  { title: "Users", icon: mdiAccount, to: "/admin/users", permission: "users.read" },
  { title: "User groups", icon: mdiAccountGroup, to: "/admin/user-groups", permission: "user-groups.read" },
  { title: "Service accounts", icon: mdiKeyChain, to: "/admin/service-accounts", permission: "service-accounts.manage" },
  { title: "Email", icon: mdiEmailOutline, to: "/admin/email", permission: "email.manage" },
  { title: "Base map", icon: mdiLayersOutline, to: "/admin/base-map", permission: "settings.manage" },
  { title: "TAK server", icon: mdiServerNetwork, to: "/admin/tak-server", permission: "tak-server.manage" },
];
