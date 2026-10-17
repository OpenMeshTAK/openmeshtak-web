import { api } from "@/shared/api/client";
import { ApiProblem, describeError } from "@/shared/errors/api-problem";
import type { MeshObservation } from "./mesh-observation";
import type { SendOutcome } from "./mesh-uplink";

export interface HqIdentity {
  id: string;
  name: string;
}

/**
 * `Retry-After` in seconds or as an HTTP date; Core's rate limiter also sends the IETF draft
 * `RateLimit` header, whose `t` parameter is the same wait in seconds.
 */
export function retryAfterMs(headers: Headers, now = Date.now()): number | null {
  const retryAfter = headers.get("Retry-After");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }
  const reset = /(?:^|;)\s*t=(\d+)/.exec(headers.get("RateLimit") ?? "");
  return reset === null ? null : Number(reset[1]) * 1000;
}

/** One upload of the mesh uplink. Network failures are an outcome too, never an exception. */
export async function sendMeshObservations(eventId: string, hq: HqIdentity, observations: MeshObservation[]): Promise<SendOutcome> {
  try {
    const name = hq.name.trim();
    const { data, error, response } = await api.POST("/events/{eventId}/mesh-observations", {
      params: { path: { eventId } },
      body: { hqId: hq.id, ...(name === "" ? {} : { hqName: name }), observations },
    });
    if (response.ok && data !== undefined) return { kind: "ok", result: data };
    return {
      kind: "problem",
      status: response.status,
      message: describeError(new ApiProblem(response.status, error)),
      retryAfterMs: retryAfterMs(response.headers),
    };
  } catch (caught: unknown) {
    return { kind: "network", message: describeError(caught) };
  }
}
