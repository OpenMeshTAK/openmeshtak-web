import {
  mdiAccountGroup,
  mdiBellOutline,
  mdiBugOutline,
  mdiCardAccountDetailsOutline,
  mdiCog,
  mdiCrosshairsGps,
  mdiFileImageOutline,
  mdiGestureTap,
  mdiHistory,
  mdiLanConnect,
  mdiMapOutline,
  mdiNavigationVariantOutline,
  mdiPlaylistEdit,
  mdiRuler,
  mdiTarget,
} from "@mdi/js";
import type { SettingsSearchEntry, SettingsSection } from "@/shared/settings/settings-search";
import type { AtakCatalogKeyDto, AtakPreferenceCatalogDto, AtakPreferenceEntryDto } from "./tak-configuration.api";

export const APP_PREFERENCES = "com.atakmap.app_preferences";
export type PreferenceTarget = AtakPreferenceEntryDto["target"];

/** A target to choose from: its kind shown as a badge, then its name. */
export interface TargetOption {
  value: string;
  kind: "Event" | "Group" | "Role" | "Member";
  name: string;
  /** Extra detail such as a member's event group. */
  detail?: string | undefined;
  /** How many settings this target holds. */
  count: number;
}

/** Icons for the catalog topics; a topic a later Core adds gets a generic icon. */
const TOPIC_ICONS: Record<string, string> = {
  "display-and-units": mdiRuler,
  "map-and-screen": mdiMapOutline,
  operation: mdiGestureTap,
  "position-reporting": mdiCrosshairsGps,
  "stale-data-and-tracks": mdiHistory,
  "routes-and-navigation": mdiNavigationVariantOutline,
  "markers-and-fires": mdiTarget,
  "notifications-and-chat": mdiBellOutline,
  "files-media-and-video": mdiFileImageOutline,
  "connection-and-mesh": mdiLanConnect,
  "contact-details": mdiCardAccountDetailsOutline,
  diagnostics: mdiBugOutline,
};

export function topicSectionId(topicId: string): string {
  return `topic:${topicId}`;
}

export function targetKey(target: PreferenceTarget): string {
  return target.type === "event" ? "event" : `${target.type}:${target.id ?? ""}`;
}

export function targetOf(key: string): PreferenceTarget {
  if (key === "event") {
    return { type: "event", id: null };
  }
  const [type, id] = key.split(":") as [Exclude<PreferenceTarget["type"], "event">, string];
  return { type, id };
}

/** For lists, the description without its value codes, which the list already names; units stay. */
export function fieldLabel(definition: AtakCatalogKeyDto): string {
  return definition.values === null ? definition.description : definition.description.replace(/\s*\([^)]*\)$/, "");
}

export function settingId(key: string): string {
  return `tak:${key}`;
}

/**
 * The catalog topics as the topic pages show them: settings for the whole event, so personal keys
 * that only fit one member are left out, and topics without any other key disappear.
 */
export function eventTopics(catalog: AtakPreferenceCatalogDto | null): AtakPreferenceCatalogDto["topics"] {
  return (catalog?.topics ?? [])
    .map((topic) => ({ ...topic, keys: topic.keys.filter(({ use }) => use !== "member") }))
    .filter(({ keys }) => keys.length > 0);
}

export function takSections(catalog: AtakPreferenceCatalogDto | null, problemSections: ReadonlySet<string>): SettingsSection[] {
  return [
    {
      id: "groups",
      title: "TAK groups",
      description: "Control who sees whom on the TAK server and configure advanced TAK groups.",
      icon: mdiAccountGroup,
      group: "Setup",
    },
    {
      id: "targeted",
      title: "Targeted & custom",
      description: "Settings for single groups, roles or members, plugin settings and .pref imports.",
      icon: mdiPlaylistEdit,
      group: "Setup",
      problem: problemSections.has("targeted"),
    },
    ...eventTopics(catalog).map((topic) => ({
      id: topicSectionId(topic.id),
      title: topic.title,
      description: topic.description,
      icon: TOPIC_ICONS[topic.id] ?? mdiCog,
      group: "ATAK settings",
      problem: problemSections.has(topicSectionId(topic.id)),
    })),
  ];
}

/** Everything the TAK view can find: the setup sections' settings and every catalog key. */
export function takSearchIndex(catalog: AtakPreferenceCatalogDto | null): SettingsSearchEntry[] {
  const setup: SettingsSearchEntry[] = [
    { id: "tak:group-mode", sectionId: "groups", sectionTitle: "TAK groups", label: "Who sees whom", description: "Everyone, own group only or TAK groups" },
    { id: "tak:groups-in-app", sectionId: "groups", sectionTitle: "TAK groups", label: "Show groups in TAK apps" },
    { id: "tak:groups-list", sectionId: "groups", sectionTitle: "TAK groups", label: "Groups", description: "Receive and send per member" },
    { id: "tak:import", sectionId: "targeted", sectionTitle: "Targeted & custom", label: "Import .pref file", description: "ATAK settings export" },
    { id: "tak:add", sectionId: "targeted", sectionTitle: "Targeted & custom", label: "Add setting", description: "Any key, including plugin settings" },
  ];
  const keys = eventTopics(catalog).flatMap((topic) =>
    topic.keys.map((definition) => ({
      id: settingId(definition.key),
      sectionId: topicSectionId(topic.id),
      sectionTitle: topic.title,
      label: fieldLabel(definition),
      description: definition.description,
      key: definition.key,
      options: definition.values?.map(({ label }) => label),
      advanced: definition.use === "advanced",
    })),
  );
  return [...setup, ...keys];
}

/** Position of the entry for one target and key, or -1. */
export function entryIndex(entries: AtakPreferenceEntryDto[], target: PreferenceTarget, preference: string, key: string): number {
  const wanted = targetKey(target);
  return entries.findIndex((entry) => targetKey(entry.target) === wanted && entry.preference === preference && entry.key === key);
}

/**
 * The list with one catalog key set for one target; `null` removes the entry, so the event sends
 * nothing and devices keep what they have.
 */
export function withValue(
  entries: AtakPreferenceEntryDto[],
  target: PreferenceTarget,
  definition: Pick<AtakCatalogKeyDto, "key" | "type">,
  value: string | null,
): AtakPreferenceEntryDto[] {
  const index = entryIndex(entries, target, APP_PREFERENCES, definition.key);
  if (value === null) {
    return index < 0 ? entries : entries.filter((_, position) => position !== index);
  }
  if (index >= 0) {
    return entries.map((entry, position) => (position === index ? { ...entry, value } : entry));
  }
  return [...entries, { target, preference: APP_PREFERENCES, key: definition.key, type: definition.type, value }];
}

/** Core's messages for the entry at `index`, from fields such as `entries[3].value`. */
export function entryMessages(errors: Record<string, string>, index: number): string[] {
  const prefix = `entries[${String(index)}].`;
  return Object.entries(errors)
    .filter(([field]) => field.startsWith(prefix))
    .map(([, message]) => message);
}
