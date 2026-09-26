import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type TakServerSettingsDto = Schemas["TakServerSettingsDto"];
export type TakCertificateAuthorityDto = Schemas["TakCertificateAuthorityDto"];
export type TakClientCertificateDto = Schemas["TakClientCertificateDto"];
export type TakEnrollmentDto = Schemas["TakEnrollmentDto"];
export type TakServerSettingsChanges = Omit<Schemas["UpdateTakServerSettingsRequest"], "version">;

export function getTakServerSettings(): Promise<TakServerSettingsDto> {
  return unwrap(api.GET("/tak-server/settings"));
}

export function saveTakServerSettings(version: number, changes: TakServerSettingsChanges): Promise<TakServerSettingsDto> {
  return unwrap(api.PUT("/tak-server/settings", { body: { version, ...changes } }));
}

/** The key is sent once and never returned by Core. */
export function addTakServerCertificate(certificateChainPem: string, privateKeyPem: string): Promise<TakServerSettingsDto> {
  return unwrap(api.PUT("/tak-server/server-certificate", { body: { certificateChainPem, privateKeyPem } }));
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
