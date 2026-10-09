import { mdiAccessPointNetwork, mdiBookshelf, mdiCellphoneLink, mdiChip } from "@mdi/js";
import type { SettingsSearchEntry, SettingsSection } from "@/shared/settings/settings-search";
import type { FirmwareEnumValueDto, FirmwareFieldDto, FirmwareSectionDto } from "./meshtastic-configuration.api";
import { sectionIcon } from "./section-icons";

export function settingId(key: string): string {
  return `meshtastic:${key}`;
}

const SETUP: Array<Omit<SettingsSection, "group">> = [
  {
    id: "firmware",
    title: "Firmware",
    description:
      "Participants are asked to flash this firmware before importing their settings. Settings that need a newer patch appear once you raise the minimum version.",
    icon: mdiChip,
  },
  {
    id: "channels",
    title: "Channels",
    description: "The first channel is the primary channel and reaches every member; the others reach only their audience.",
    icon: mdiAccessPointNetwork,
  },
  {
    id: "tak-connection",
    title: "TAK connection",
    description:
      "ATAK or iTAK connect to the Meshtastic app, which carries TAK over the mesh. Participants get step-by-step instructions with this event's values on their dashboard.",
    icon: mdiCellphoneLink,
  },
  {
    id: "presets",
    title: "Presets",
    description: "Download these radio settings as a reusable preset, save them to the library or import a preset from another event.",
    icon: mdiBookshelf,
  },
];

export function meshtasticSections(
  profileSections: FirmwareSectionDto[],
  firmwareVersion: string,
  hasProblem: (sectionId: string) => boolean,
): SettingsSection[] {
  return [
    ...SETUP.map((section) => ({ ...section, group: "Setup", badge: section.id === "firmware" ? firmwareVersion : undefined })),
    ...profileSections.map((section) => ({
      id: section.id,
      title: section.label,
      icon: sectionIcon(section.id),
      group: "Radio settings",
      problem: hasProblem(section.id),
    })),
  ];
}

/**
 * The setup sections and every field the event's firmware shows. Secrets are indexed by name only;
 * no value of any setting enters the index.
 */
export function meshtasticSearchIndex(
  profileSections: FirmwareSectionDto[],
  fields: FirmwareFieldDto[],
  enums: Record<string, FirmwareEnumValueDto[]>,
): SettingsSearchEntry[] {
  const titles = new Map(profileSections.map(({ id, label }) => [id, label]));
  const setup: SettingsSearchEntry[] = [
    { id: "meshtastic:firmware", sectionId: "firmware", sectionTitle: "Firmware", label: "Change firmware", description: "Firmware version and minimum patch" },
    { id: "meshtastic:add-channel", sectionId: "channels", sectionTitle: "Channels", label: "Add channel", description: "Primary and secondary channels, audiences, secret channels" },
    { id: "meshtastic:tak-channel", sectionId: "tak-connection", sectionTitle: "TAK connection", label: "TAK mesh channel", description: "Channel the Meshtastic app sends TAK on" },
    { id: "presets:download", sectionId: "presets", sectionTitle: "Presets", label: "Download preset", description: "Export the radio settings as a JSON preset" },
    { id: "presets:import-file", sectionId: "presets", sectionTitle: "Presets", label: "Import preset", description: "Import radio settings from a preset file or the library" },
  ];
  const profileFields = fields
    .filter((field) => titles.has(field.section))
    .map((field) => ({
      id: settingId(field.key),
      sectionId: field.section,
      sectionTitle: titles.get(field.section) ?? field.section,
      label: field.label,
      description: field.description,
      key: field.key,
      options: field.enum === undefined ? undefined : (enums[field.enum] ?? []).map(({ label }) => label),
    }));
  return [...setup, ...profileFields];
}
