import { api, unwrap } from "@/shared/api/client";

let configured = false;

/** Setup can only move from incomplete to complete, so a positive answer is cached for good. */
export async function isSetupComplete(): Promise<boolean> {
  if (!configured) {
    configured = (await unwrap(api.GET("/setup"))).configured;
  }
  return configured;
}

export function markSetupComplete(): void {
  configured = true;
}
