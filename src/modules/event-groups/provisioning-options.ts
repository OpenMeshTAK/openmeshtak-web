import type { Schemas } from "@/shared/api/types";

/** Fails to compile when a list misses a value of the API's enum. */
type Exhaustive<All, Listed extends readonly All[]> = Exclude<All, Listed[number]> extends never ? Listed : never;

const takTeams = [
  "White", "Yellow", "Orange", "Magenta", "Red", "Maroon", "Purple",
  "Dark Blue", "Blue", "Cyan", "Teal", "Green", "Dark Green", "Brown",
] as const;
const takRoles = [
  "Team Member", "Team Lead", "HQ", "Sniper", "Medic", "Forward Observer", "RTO", "K9",
] as const;

/** Select options mirroring Core's allowlists, which in turn mirror the upstream protobufs. */
export const takTeamOptions: Exhaustive<Schemas["TakTeam"], typeof takTeams> = takTeams;
export const takRoleOptions: Exhaustive<Schemas["TakRole"], typeof takRoles> = takRoles;
