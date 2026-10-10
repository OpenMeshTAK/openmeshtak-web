import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type SystemStatusDto = Schemas["SystemStatusDto"];
export type SystemCheckDto = Schemas["SystemCheckDto"];
export type SystemCheckState = Schemas["SystemCheckState"];
export type LoggedProblemDto = Schemas["LoggedProblemDto"];

export function getSystemStatus(): Promise<SystemStatusDto> {
  return unwrap(api.GET("/system-status"));
}
