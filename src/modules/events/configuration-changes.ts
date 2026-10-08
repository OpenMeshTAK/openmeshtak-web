import type { ConfigurationChange } from "./events.api";

const AREA_LABELS: Record<ConfigurationChange["area"], string> = {
  event: "Event",
  roles: "Role",
  groups: "Group",
  channels: "Channel",
  meshtastic: "Meshtastic",
  tak: "TAK",
};

const KIND_LABELS: Record<ConfigurationChange["kind"], string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
};

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  slug: "slug",
  takRoleOverride: "TAK role override",
  "provisioning.callsignFormat": "callsign format",
  "provisioning.shortNamePrefix": "short-name prefix",
  "provisioning.tak.team": "TAK team",
  "provisioning.tak.role": "TAK role",
  "provisioning.tak.serverGroups": "TAK server groups",
  uplinkEnabled: "uplink",
  downlinkEnabled: "downlink",
  positionPrecision: "position precision",
  secret: "secret",
  pskVersion: "key rotated",
  audience: "audience",
  keyHolders: "key holders",
  firmwareVersion: "recommended firmware",
  effectiveMinimumVersion: "minimum firmware",
};

export interface ChangeLine {
  key: string;
  kind: string;
  title: string;
  detail: string;
}

/** One readable line per change, e.g. "Changed · Group Bravo" with "callsign format". */
export function describeChange(change: ConfigurationChange, index: number): ChangeLine {
  const subject = change.area === "event" || change.area === "tak" ? change.name : `${AREA_LABELS[change.area]} ${change.name}`;
  return {
    key: `${change.area}-${String(index)}`,
    kind: KIND_LABELS[change.kind],
    title: subject,
    detail: change.fields.map((field) => FIELD_LABELS[field] ?? field).join(", "),
  };
}
