import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type MeshtasticConfigurationDto = Schemas["MeshtasticConfigurationDto"];
export type FirmwareProfileDto = Schemas["FirmwareProfileDto"];
export type FirmwareProfileSummaryDto = Schemas["FirmwareProfileSummaryDto"];
export type FirmwareFieldDto = Schemas["FirmwareFieldDto"];
export type FirmwareChangePreviewDto = Schemas["FirmwareChangePreviewDto"];
export type FirmwareEnumValueDto = Schemas["FirmwareEnumValueDto"];
export type FirmwareSectionDto = Schemas["FirmwareSectionDto"];
export type SettingValue = string | number | boolean;

export function getConfiguration(eventId: string): Promise<MeshtasticConfigurationDto> {
  return unwrap(api.GET("/events/{eventId}/meshtastic/configuration", { params: { path: { eventId } } }));
}

export function listFirmwareProfiles(): Promise<FirmwareProfileSummaryDto[]> {
  return unwrap(api.GET("/meshtastic/firmware-profiles"));
}

export function getFirmwareProfile(profileId: string): Promise<FirmwareProfileDto> {
  return unwrap(api.GET("/meshtastic/firmware-profiles/{profileId}", { params: { path: { profileId } } }));
}

export function saveSettings(
  eventId: string,
  version: number,
  settings: Record<string, SettingValue>,
): Promise<MeshtasticConfigurationDto> {
  return unwrap(
    api.PUT("/events/{eventId}/meshtastic/configuration/settings", {
      params: { path: { eventId } },
      body: { version, settings },
    }),
  );
}

export function previewFirmwareChange(eventId: string, firmwareVersion: string): Promise<FirmwareChangePreviewDto> {
  return unwrap(
    api.POST("/events/{eventId}/meshtastic/configuration/firmware/preview", {
      params: { path: { eventId } },
      body: { firmwareVersion },
    }),
  );
}

export function changeFirmware(
  eventId: string,
  version: number,
  firmwareVersion: string,
  confirmation: string | null,
): Promise<MeshtasticConfigurationDto> {
  return unwrap(
    api.PUT("/events/{eventId}/meshtastic/configuration/firmware", {
      params: { path: { eventId } },
      body: { version, firmwareVersion, ...(confirmation === null ? {} : { confirmation }) },
    }),
  );
}

/** Sets (`value`) or clears (`null`) write-only secrets; Core never returns their values. */
export function saveSecrets(
  eventId: string,
  version: number,
  secrets: Record<string, string | number | null>,
): Promise<MeshtasticConfigurationDto> {
  return unwrap(
    api.PUT("/events/{eventId}/meshtastic/configuration/secrets", {
      params: { path: { eventId } },
      body: { version, secrets },
    }),
  );
}
