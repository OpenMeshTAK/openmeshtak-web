import type { EventMemberDto } from "@/modules/members/members.api";
import type { ChannelAudience, MeshtasticChannelDto } from "./meshtastic-channels.api";

function matches(member: EventMemberDto, audience: ChannelAudience): boolean {
  return (
    audience.groupIds.includes(member.eventGroup.id) ||
    audience.roleIds.includes(member.eventRole.id) ||
    audience.memberIds.includes(member.id)
  );
}

/** Resolves the union audience exactly as Core does. The server remains authoritative. */
export function channelRecipients(channel: MeshtasticChannelDto, members: EventMemberDto[]): EventMemberDto[] {
  return channel.primary ? members : members.filter((member) => matches(member, channel.audience));
}

/** Key holders count only when they are also part of the channel audience. */
export function channelKeyHolders(channel: MeshtasticChannelDto, members: EventMemberDto[]): EventMemberDto[] {
  const recipients = new Set(channelRecipients(channel, members).map((member) => member.id));
  return members.filter((member) => recipients.has(member.id) && matches(member, channel.keyHolders));
}

export function moveInDeviceOrder(
  channels: MeshtasticChannelDto[],
  channelId: string,
  offset: -1 | 1,
): MeshtasticChannelDto[] | null {
  const from = channels.findIndex((channel) => channel.id === channelId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= channels.length) {
    return null;
  }

  const reordered = [...channels];
  [reordered[from], reordered[to]] = [reordered[to]!, reordered[from]!];
  return reordered;
}
