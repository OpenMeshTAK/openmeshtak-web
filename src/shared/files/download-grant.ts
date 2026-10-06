import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type DownloadGrantRequest = Schemas["CreateDownloadGrantRequest"];
export type DownloadGrant = Schemas["DownloadGrantDto"];

/**
 * A five-minute link that downloads one artifact without a session, so a phone can fetch it from
 * a QR code. Core checks the same access as the normal download and audits the grant. The URL is
 * a secret: keep it only while it is shown.
 */
export function createDownloadGrant(request: DownloadGrantRequest): Promise<DownloadGrant> {
  return unwrap(api.POST("/me/download-grants", { body: request }));
}
