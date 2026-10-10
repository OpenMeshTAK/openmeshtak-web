import type { Permission } from "@/shared/api/types";

/** Search must not offer preset actions hidden by the view's permission gates. */
export function canFindPresetAction(
  id: string,
  editable: boolean,
  can: (permission: Permission, eventId?: string | null) => boolean,
): boolean {
  if (id === "presets:save") return can("presets.manage", null);
  if (id === "presets:import-library") return editable && can("presets.read", null);
  if (id === "presets:import-file") return editable;
  return true;
}
