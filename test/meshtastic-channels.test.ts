import { describe, expect, it } from "vitest";
import type { EventMemberDto } from "@/modules/members/members.api";
import {
  channelKeyHolders,
  channelRecipients,
  moveInDeviceOrder,
} from "@/modules/meshtastic-channels/channel-recipients";
import type { MeshtasticChannelDto } from "@/modules/meshtastic-channels/meshtastic-channels.api";

function member(id: string, groupId: string, roleId: string): EventMemberDto {
  return {
    id,
    eventGroup: { id: groupId, name: groupId, slug: groupId },
    eventRole: { id: roleId, name: roleId, slug: roleId },
    callsign: id,
    displayName: id,
  } as EventMemberDto;
}

function channel(overrides: Partial<MeshtasticChannelDto> = {}): MeshtasticChannelDto {
  return {
    id: "channel-1",
    eventId: "event-1",
    name: "Bravo",
    sortOrder: 0,
    primary: false,
    psk: { kind: "aes256", version: 1, rotatedAt: null },
    uplinkEnabled: false,
    downlinkEnabled: false,
    positionPrecision: 0,
    audience: { groupIds: [], roleIds: [], memberIds: [] },
    secret: false,
    releasedAt: null,
    keyHolders: { groupIds: [], roleIds: [], memberIds: [] },
    version: 1,
    createdAt: "2027-01-01T00:00:00.000Z",
    updatedAt: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Meshtastic channel recipients", () => {
  const members = [member("Peter", "bravo", "participant"), member("Lisa", "alpha", "leader")];

  it("uses the union of groups, roles and individual members", () => {
    const recipients = channelRecipients(
      channel({ audience: { groupIds: ["bravo"], roleIds: ["leader"], memberIds: [] } }),
      members,
    );
    expect(recipients.map(({ id }) => id)).toEqual(["Peter", "Lisa"]);
  });

  it("shows every member on the primary channel", () => {
    expect(channelRecipients(channel({ primary: true }), members)).toEqual(members);
  });

  it("intersects key holders with the channel audience", () => {
    const holders = channelKeyHolders(
      channel({
        secret: true,
        audience: { groupIds: ["bravo"], roleIds: [], memberIds: [] },
        keyHolders: { groupIds: [], roleIds: ["leader"], memberIds: ["Peter"] },
      }),
      members,
    );
    expect(holders.map(({ id }) => id)).toEqual(["Peter"]);
  });
});

describe("Meshtastic channel ordering", () => {
  it("moves adjacent channels", () => {
    const first = channel({ id: "first", primary: true });
    const second = channel({ id: "second", sortOrder: 1 });
    expect(moveInDeviceOrder([first, second], "second", -1)?.map(({ id }) => id)).toEqual(["second", "first"]);
  });

  it("does not move a secret channel into the primary position", () => {
    const first = channel({ id: "first", primary: true });
    const secret = channel({ id: "secret", sortOrder: 1, secret: true });
    expect(moveInDeviceOrder([first, secret], "secret", -1)).toBeNull();
  });
});
