import {
  mdiAccountCircle,
  mdiAntenna,
  mdiBatteryHigh,
  mdiBell,
  mdiBluetooth,
  mdiCellphoneCog,
  mdiChartLine,
  mdiCloudSync,
  mdiCog,
  mdiCrosshairsGps,
  mdiDatabaseClock,
  mdiLan,
  mdiMapMarkerDistance,
  mdiMessageText,
  mdiMonitor,
  mdiRadar,
  mdiShieldKey,
  mdiAccountMultiple,
} from "@mdi/js";

/**
 * Icons for the section ids firmware profiles use, following the official Meshtastic apps.
 * Sections a future profile adds fall back to a generic icon, so no profile needs a Web change.
 */
const SECTION_ICONS: Record<string, string> = {
  owner: mdiAccountCircle,
  lora: mdiAntenna,
  device: mdiCellphoneCog,
  position: mdiCrosshairsGps,
  power: mdiBatteryHigh,
  display: mdiMonitor,
  bluetooth: mdiBluetooth,
  network: mdiLan,
  security: mdiShieldKey,
  mqtt: mdiCloudSync,
  telemetry: mdiChartLine,
  neighborInfo: mdiAccountMultiple,
  rangeTest: mdiMapMarkerDistance,
  storeForward: mdiDatabaseClock,
  cannedMessage: mdiMessageText,
  externalNotification: mdiBell,
  detectionSensor: mdiRadar,
};

export function sectionIcon(sectionId: string): string {
  return SECTION_ICONS[sectionId] ?? mdiCog;
}
