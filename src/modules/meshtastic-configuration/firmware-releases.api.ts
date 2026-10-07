import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type FirmwareReleaseListDto = Schemas["FirmwareReleaseListDto"];
export type FirmwareReleaseDto = Schemas["FirmwareReleaseDto"];
export type FirmwareReleaseSettingsDto = Schemas["FirmwareReleaseSettingsDto"];

/** Published releases from the Meshtastic flasher; the release view is optional, so failures yield null. */
export function listFirmwareReleases(): Promise<FirmwareReleaseListDto | null> {
  return unwrap(api.GET("/meshtastic/firmware-releases")).catch(() => null);
}

export function getFirmwareReleaseSettings(): Promise<FirmwareReleaseSettingsDto> {
  return unwrap(api.GET("/meshtastic/firmware-releases/settings"));
}

export function saveFirmwareReleaseSettings(version: number, checkEnabled: boolean): Promise<FirmwareReleaseSettingsDto> {
  return unwrap(api.PUT("/meshtastic/firmware-releases/settings", { body: { version, checkEnabled } }));
}
