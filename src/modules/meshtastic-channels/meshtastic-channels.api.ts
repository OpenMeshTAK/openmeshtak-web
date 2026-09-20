import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type MeshtasticChannelDto = Schemas["MeshtasticChannelDto"];
export type ChannelAudience = Schemas["EventAudience"];
export type UpdateChannelRequest = Schemas["UpdateMeshtasticChannelRequest"];

/** Device order: Core treats the lowest `sortOrder` as primary, oldest first on ties. */
export function inDeviceOrder(channels: MeshtasticChannelDto[]): MeshtasticChannelDto[] {
  return [...channels].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

export async function listChannels(eventId: string): Promise<MeshtasticChannelDto[]> {
  const page = await unwrap(
    api.GET("/events/{eventId}/meshtastic/channels", {
      params: { path: { eventId }, query: { limit: 100 } },
    }),
  );
  return inDeviceOrder(page.items);
}

export function createChannel(
  eventId: string,
  body: Schemas["CreateMeshtasticChannelRequest"],
): Promise<MeshtasticChannelDto> {
  return unwrap(api.POST("/events/{eventId}/meshtastic/channels", { params: { path: { eventId } }, body }));
}

export function updateChannel(
  eventId: string,
  channelId: string,
  body: UpdateChannelRequest,
): Promise<MeshtasticChannelDto> {
  return unwrap(
    api.PUT("/events/{eventId}/meshtastic/channels/{channelId}", {
      params: { path: { eventId, channelId } },
      body,
    }),
  );
}

export async function deleteChannel(eventId: string, channelId: string): Promise<void> {
  await unwrap(
    api.DELETE("/events/{eventId}/meshtastic/channels/{channelId}", {
      params: { path: { eventId, channelId } },
    }),
  );
}

export function rotateChannelKey(
  eventId: string,
  channel: MeshtasticChannelDto,
  psk?: string,
): Promise<MeshtasticChannelDto> {
  return unwrap(
    api.POST("/events/{eventId}/meshtastic/channels/{channelId}/psk/rotate", {
      params: { path: { eventId, channelId: channel.id } },
      body: { version: channel.version, ...(psk === undefined ? {} : { psk }) },
    }),
  );
}

export function releaseChannel(eventId: string, channel: MeshtasticChannelDto): Promise<MeshtasticChannelDto> {
  return unwrap(
    api.POST("/events/{eventId}/meshtastic/channels/{channelId}/release", {
      params: { path: { eventId, channelId: channel.id } },
      body: { version: channel.version },
    }),
  );
}

/** Audited by Core. The caller keeps the key only while it is on screen. */
export function revealChannelKey(eventId: string, channelId: string): Promise<Schemas["RevealedChannelPsk"]> {
  return unwrap(
    api.POST("/events/{eventId}/meshtastic/channels/{channelId}/psk/reveal", {
      params: { path: { eventId, channelId } },
    }),
  );
}

/** The complete update body for a channel, so single fields can change without losing others. */
export function toUpdateRequest(channel: MeshtasticChannelDto): UpdateChannelRequest {
  return {
    version: channel.version,
    name: channel.name,
    sortOrder: channel.sortOrder,
    uplinkEnabled: channel.uplinkEnabled,
    downlinkEnabled: channel.downlinkEnabled,
    positionPrecision: channel.positionPrecision,
    audience: channel.audience,
    secret: channel.secret,
    keyHolders: channel.keyHolders,
  };
}
