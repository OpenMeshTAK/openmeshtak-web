import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type TakServerSettingsDto = Schemas["TakServerSettingsDto"];
export type TakCertificateAuthorityDto = Schemas["TakCertificateAuthorityDto"];
export type TakClientCertificateDto = Schemas["TakClientCertificateDto"];
export type TakEnrollmentDto = Schemas["TakEnrollmentDto"];
export type TakAcmeSettingsDto = Schemas["TakAcmeSettingsDto"];
export type TakAcmeTestResultDto = Schemas["TakAcmeTestResultDto"];
export type TakServerSettingsChanges = Omit<Schemas["UpdateTakServerSettingsRequest"], "version">;
export type TakAcmeSettingsChanges = Omit<Schemas["UpdateTakAcmeSettingsRequest"], "version">;

export function getTakServerSettings(): Promise<TakServerSettingsDto> {
  return unwrap(api.GET("/tak-server/settings"));
}

export function saveTakServerSettings(version: number, changes: TakServerSettingsChanges): Promise<TakServerSettingsDto> {
  return unwrap(api.PUT("/tak-server/settings", { body: { version, ...changes } }));
}

export function getTakAcmeSettings(): Promise<TakAcmeSettingsDto> {
  return unwrap(api.GET("/tak-server/acme"));
}

/** Leave `apiToken` out to keep the encrypted provider token; Core never returns it. */
export function saveTakAcmeSettings(version: number, changes: TakAcmeSettingsChanges): Promise<TakAcmeSettingsDto> {
  return unwrap(api.PUT("/tak-server/acme", { body: { version, ...changes } }));
}

export function renewTakAcmeCertificate(): Promise<TakAcmeSettingsDto> {
  return unwrap(api.POST("/tak-server/acme/renew"));
}

/** Runs the saved settings against Let's Encrypt staging; nothing is installed. */
export function testTakAcmeSetup(): Promise<TakAcmeTestResultDto> {
  return unwrap(api.POST("/tak-server/acme/test"));
}

/** The key is sent once and never returned by Core. */
export function addTakServerCertificate(certificateChainPem: string, privateKeyPem: string): Promise<TakServerSettingsDto> {
  return unwrap(api.PUT("/tak-server/server-certificate", { body: { certificateChainPem, privateKeyPem } }));
}

/** Paths are relative to the directory where the reverse proxy's certificates are mounted. */
export function useTakCertificateFiles(files: Schemas["UseTakCertificateFilesRequest"]): Promise<TakServerSettingsDto> {
  return unwrap(api.PUT("/tak-server/server-certificate/files", { body: files }));
}

export function removeTakServerCertificate(): Promise<TakServerSettingsDto> {
  return unwrap(api.DELETE("/tak-server/server-certificate"));
}

export function listCertificateAuthorities(): Promise<TakCertificateAuthorityDto[]> {
  return unwrap(api.GET("/tak-server/certificate-authorities"));
}

export function importCertificateAuthority(certificatePem: string, privateKeyPem: string): Promise<TakCertificateAuthorityDto> {
  return unwrap(api.POST("/tak-server/certificate-authorities/import", { body: { certificatePem, privateKeyPem } }));
}

export function listClientCertificates(): Promise<TakClientCertificateDto[]> {
  return unwrap(api.GET("/tak-server/client-certificates"));
}

export function revokeClientCertificate(certificateId: string): Promise<TakClientCertificateDto> {
  return unwrap(
    api.POST("/tak-server/client-certificates/{certificateId}/revoke", { params: { path: { certificateId } }, body: {} }),
  );
}

/** Core audits it; the token is shown only while the enrollment dialog is open. */
export function createTakEnrollment(): Promise<TakEnrollmentDto> {
  return unwrap(api.POST("/me/tak-enrollments"));
}

export function listMyTakCertificates(): Promise<TakClientCertificateDto[]> {
  return unwrap(api.GET("/me/tak-certificates"));
}

export function revokeMyTakCertificate(certificateId: string): Promise<TakClientCertificateDto> {
  return unwrap(api.POST("/me/tak-certificates/{certificateId}/revoke", { params: { path: { certificateId } }, body: {} }));
}

export function rotateCertificateAuthority(): Promise<TakCertificateAuthorityDto> {
  return unwrap(api.POST("/tak-server/certificate-authorities/rotate"));
}

export type LiveTakTrafficDto = Schemas["LiveTakTrafficDto"];

/** The event's current TAK traffic from the built-in server's memory. */
export function getLiveTakTraffic(eventId: string): Promise<LiveTakTrafficDto> {
  return unwrap(api.GET("/events/{eventId}/tak-traffic", { params: { path: { eventId } } }));
}

export type TakTrafficRecordingDto = Schemas["TakTrafficRecordingDto"];

export function getTakTrafficRecording(eventId: string): Promise<TakTrafficRecordingDto> {
  return unwrap(api.GET("/events/{eventId}/tak-traffic/recording", { params: { path: { eventId } } }));
}

export function saveTakTrafficRecording(
  eventId: string,
  version: number,
  enabled: boolean,
  retentionDays: number,
): Promise<TakTrafficRecordingDto> {
  return unwrap(
    api.PUT("/events/{eventId}/tak-traffic/recording", { params: { path: { eventId } }, body: { version, enabled, retentionDays } }),
  );
}

/** Same-origin link: the browser downloads with the session cookie, and Core audits the export. */
export function takTrafficExportUrl(eventId: string): string {
  return `/api/v1/events/${encodeURIComponent(eventId)}/tak-traffic/recording/export`;
}

export type TakTrafficHistoryDto = Schemas["TakTrafficHistoryDto"];
export type TakTrackDto = Schemas["TakTrackDto"];
export type TakTrackPointDto = Schemas["TakTrackPointDto"];

export interface TakTrafficHistoryFilter {
  from: string;
  to: string;
  groupId?: string | undefined;
  uid?: string | undefined;
  gapSeconds?: number | undefined;
}

function historyQuery(filter: TakTrafficHistoryFilter): Record<string, string> {
  const query: Record<string, string> = { from: filter.from, to: filter.to };
  if (filter.groupId !== undefined) query.groupId = filter.groupId;
  if (filter.uid !== undefined) query.uid = filter.uid;
  if (filter.gapSeconds !== undefined) query.gapSeconds = String(filter.gapSeconds);
  return query;
}

/** Recorded positions of the event as tracks; Core audits every request. */
export function getTakTrafficHistory(eventId: string, filter: TakTrafficHistoryFilter): Promise<TakTrafficHistoryDto> {
  const query = {
    from: filter.from,
    to: filter.to,
    ...(filter.groupId === undefined ? {} : { groupId: filter.groupId }),
    ...(filter.uid === undefined ? {} : { uid: filter.uid }),
    ...(filter.gapSeconds === undefined ? {} : { gapSeconds: filter.gapSeconds }),
  };
  return unwrap(api.GET("/events/{eventId}/tak-traffic/history", { params: { path: { eventId }, query } }));
}

/** Same-origin download link for the tracks of the current filter as GeoJSON or GPX. */
export function takTrackExportUrl(eventId: string, format: "geojson" | "gpx", filter: TakTrafficHistoryFilter): string {
  const query = new URLSearchParams({ format, ...historyQuery(filter) });
  return `/api/v1/events/${encodeURIComponent(eventId)}/tak-traffic/history/export?${query.toString()}`;
}

/** Deletes the event's recorded traffic now, or only that of one CoT UID. */
export function deleteRecordedTakTraffic(eventId: string, uid?: string): Promise<{ deleted: number }> {
  return unwrap(
    api.DELETE("/events/{eventId}/tak-traffic/recording/items", { params: { path: { eventId }, query: uid === undefined ? {} : { uid } } }),
  );
}
