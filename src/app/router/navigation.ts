import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from "vue-router";
import type { Permission } from "@/shared/api/types";

/** What a route declares in `meta.navigation` to appear in the main navigation. */
export interface RouteNavigation {
  title: string;
  icon: string;
  /** Hint only; Core authorizes every request behind these pages. */
  permission?: Permission;
}

export interface NavigationItem extends RouteNavigation {
  /** Full path of the route record; the link target of an item without children. */
  path: string;
  /** Child routes with their own `meta.navigation`. An item with children opens a submenu. */
  children: NavigationItem[];
}

function joinPath(parent: string, path: string): string {
  if (path.startsWith("/")) return path;
  const joined = `${parent.replace(/\/$/, "")}/${path}`;
  return joined === "/" ? joined : joined.replace(/\/$/, "");
}

/**
 * Builds the navigation tree from the route table. Records without `meta.navigation`, such as
 * the app shell, are transparent: their navigable descendants move up one level.
 */
export function navigationFromRoutes(routes: readonly RouteRecordRaw[], parentPath = ""): NavigationItem[] {
  return routes.flatMap((record) => {
    const path = joinPath(parentPath, record.path);
    const children = navigationFromRoutes(record.children ?? [], path);
    const navigation = record.meta?.navigation;
    return navigation === undefined ? children : [{ ...navigation, path, children }];
  });
}

/** Drops items the user may not open, and submenus left without any item. */
export function visibleNavigation(items: readonly NavigationItem[], can: (permission: Permission) => boolean): NavigationItem[] {
  return items.flatMap((item) => {
    if (item.children.length === 0) {
      return item.permission === undefined || can(item.permission) ? [item] : [];
    }
    const children = visibleNavigation(item.children, can);
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

/**
 * An item is active while its route record is part of the current match, so a detail page
 * nested below a list route keeps the list's item lit. Only navigable records count: the app
 * shell shares the path "/" with the dashboard.
 */
export function isNavigationActive(item: NavigationItem, route: Pick<RouteLocationNormalizedLoaded, "matched">): boolean {
  return route.matched.some((record) => record.meta.navigation !== undefined && record.path === item.path);
}
