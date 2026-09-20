import type { Schemas } from "@/shared/api/types";
import { listGroups } from "@/modules/event-groups/event-groups.api";
import { listRoles } from "@/modules/event-roles/event-roles.api";
import { listMembers, type EventMemberDto } from "@/modules/members/members.api";

export type EventAudience = Schemas["EventAudience"];

export interface AudienceOption {
  id: string;
  title: string;
}

export interface AudienceOptions {
  groups: AudienceOption[];
  roles: AudienceOption[];
  /** `null` when the viewer may not list members. */
  members: EventMemberDto[] | null;
}

/** Everything an audience picker offers for one event. */
export async function loadAudienceOptions(eventId: string, canReadMembers: boolean): Promise<AudienceOptions> {
  const [groups, roles, members] = await Promise.all([
    listGroups(eventId),
    listRoles(eventId),
    canReadMembers ? listMembers(eventId) : Promise.resolve(null),
  ]);
  return {
    groups: groups.map((group) => ({ id: group.id, title: group.name })),
    roles: roles.map((role) => ({ id: role.id, title: role.name })),
    members,
  };
}

export function memberOptions(options: AudienceOptions): AudienceOption[] | null {
  return options.members?.map((member) => ({ id: member.id, title: `${member.callsign} · ${member.displayName}` })) ?? null;
}

/** Readable names of a selection, for summaries such as "Bravo, Leader (role)". */
export function audienceNames(selection: EventAudience, options: AudienceOptions): string[] {
  const nameOf = (list: AudienceOption[], id: string) => list.find((option) => option.id === id)?.title ?? "Unknown";
  return [
    ...selection.groupIds.map((id) => nameOf(options.groups, id)),
    ...selection.roleIds.map((id) => `${nameOf(options.roles, id)} (role)`),
    ...selection.memberIds.map((id) => options.members?.find((member) => member.id === id)?.callsign ?? "Member"),
  ];
}

/** Members a selection reaches, resolved exactly as Core does; the server stays authoritative. */
export function audienceMembers(selection: EventAudience, members: EventMemberDto[]): EventMemberDto[] {
  return members.filter(
    (member) =>
      selection.groupIds.includes(member.eventGroup.id) ||
      selection.roleIds.includes(member.eventRole.id) ||
      selection.memberIds.includes(member.id),
  );
}
