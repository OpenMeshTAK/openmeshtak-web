import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type AuditEventDto = Schemas["AuditEventDto"];
export type AuditEventPage = Schemas["AuditEventPage"];
export type AuditResult = Schemas["AuditResult"];

/** `all` and `instance` need instance-wide `audit.read`; an event ID needs it for that event. */
export type AuditLogScope = "all" | "instance" | { eventId: string };

export interface AuditLogFilter {
  search?: string;
  result?: AuditResult;
  cursor?: string;
}

const PAGE_SIZE = 100;

/** One page of the audit log, newest first. */
export function listAuditEvents(scope: AuditLogScope, filter: AuditLogFilter): Promise<AuditEventPage> {
  const query = {
    limit: PAGE_SIZE,
    ...(filter.search ? { search: filter.search } : {}),
    ...(filter.result ? { result: filter.result } : {}),
    ...(filter.cursor ? { cursor: filter.cursor } : {}),
  };
  if (typeof scope === "object") {
    return unwrap(api.GET("/events/{eventId}/audit-events", { params: { path: { eventId: scope.eventId }, query } }));
  }
  return unwrap(api.GET("/audit-events", { params: { query: scope === "instance" ? { ...query, scope } : query } }));
}
