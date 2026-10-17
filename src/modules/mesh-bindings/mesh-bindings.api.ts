import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type MeshtasticNodeDto = Schemas["MeshtasticNodeDto"];
export type MeshtasticNodeMemberDto = Schemas["MeshtasticNodeMemberDto"];

/** Every node of the event, oldest first; Core pages by at most 100. */
export async function listMeshtasticNodes(eventId: string): Promise<MeshtasticNodeDto[]> {
  const nodes: MeshtasticNodeDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      api.GET("/events/{eventId}/meshtastic-nodes", { params: { path: { eventId }, query: { limit: 100, ...(cursor === undefined ? {} : { cursor }) } } }),
    );
    nodes.push(...page.items);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return nodes;
}

/** `version` is the node's last read version, or 0 for a node Core has not stored yet. */
export function bindMeshtasticNode(eventId: string, nodeNum: number, memberId: string, version: number): Promise<MeshtasticNodeDto> {
  return unwrap(
    api.PUT("/events/{eventId}/meshtastic-nodes/{nodeNum}/binding", { params: { path: { eventId, nodeNum } }, body: { memberId, version } }),
  );
}

export async function unbindMeshtasticNode(eventId: string, nodeNum: number): Promise<void> {
  await unwrap(api.DELETE("/events/{eventId}/meshtastic-nodes/{nodeNum}/binding", { params: { path: { eventId, nodeNum } } }));
}
