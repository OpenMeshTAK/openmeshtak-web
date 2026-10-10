import type { RouteLocationNormalized } from "vue-router";
import type { Permission } from "@/shared/api/types";

/** UI hint only. Core authorizes the underlying requests independently. */
export function canOpenRoute(
  route: Pick<RouteLocationNormalized, "matched" | "params">,
  can: (permission: Permission, eventId?: string | null) => boolean,
): boolean {
  const eventId = typeof route.params.eventId === "string" ? route.params.eventId : null;
  const scope = route.matched.some(({ meta }) => meta.anyEvent === true) ? undefined : eventId;
  return route.matched.every(({ meta }) => {
    const required = meta.permission ?? meta.navigation?.permission;
    if (required === undefined) return true;
    return [required].flat().some((permission) => can(permission, scope));
  });
}
