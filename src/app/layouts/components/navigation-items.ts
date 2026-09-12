import { mdiAccountGroup, mdiCalendarMultiple, mdiKeyChain, mdiViewDashboard } from "@mdi/js";
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
  { title: "User groups", icon: mdiAccountGroup, to: "/admin/user-groups", permission: "user-groups.read" },
  { title: "Service accounts", icon: mdiKeyChain, to: "/admin/service-accounts", permission: "service-accounts.manage" },
];
