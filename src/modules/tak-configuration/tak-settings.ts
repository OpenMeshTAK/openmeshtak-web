import {
  mdiAccountGroup,
  mdiBellOutline,
  mdiBookshelf,
  mdiBugOutline,
  mdiCardAccountDetailsOutline,
  mdiCog,
  mdiCrosshairsGps,
  mdiFileImageOutline,
  mdiGestureTap,
  mdiHistory,
  mdiLanConnect,
  mdiLockOutline,
  mdiMapOutline,
  mdiNavigationVariantOutline,
  mdiPlaylistEdit,
  mdiRuler,
  mdiTarget,
} from "@mdi/js";
import type { SettingsSearchEntry, SettingsSection } from "@/shared/settings/settings-search";
import type { AtakCatalogKeyDto, AtakPreferenceCatalogDto, AtakPreferenceEntryDto, AtakScreenItemDto } from "./tak-configuration.api";

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
      id: "restrictions",
      title: "Lock ATAK settings",
      description: "Grey out or hide items on ATAK's settings screens, and the unlock package for after the event.",
      icon: mdiLockOutline,
      group: "Setup",
      problem: problemSections.has("restrictions"),
    },
    {
      id: "targeted",
      title: "Targeted & custom",
      description: "Settings for single groups, roles or members, plugin settings and .pref imports.",
      icon: mdiPlaylistEdit,
      group: "Setup",
      problem: problemSections.has("targeted"),
    },
    {
      id: "presets",
      title: "Presets",
      description: "Download these ATAK settings as a reusable preset, save them to the library or import a preset from another event.",
      icon: mdiBookshelf,
      group: "Setup",
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
    { id: "tak:unlock", sectionId: "restrictions", sectionTitle: "Lock ATAK settings", label: "Unlock package", description: "Make locked ATAK settings normal again after the event" },
    { id: "tak:restrictions", sectionId: "restrictions", sectionTitle: "Lock ATAK settings", label: "Locked settings", description: "Normal, greyed out or hidden in ATAK" },
    { id: "tak:import", sectionId: "targeted", sectionTitle: "Targeted & custom", label: "Import .pref file", description: "ATAK settings export" },
    { id: "tak:add", sectionId: "targeted", sectionTitle: "Targeted & custom", label: "Add setting", description: "Any key, including plugin settings" },
    { id: "presets:download", sectionId: "presets", sectionTitle: "Presets", label: "Download preset", description: "Export the ATAK settings as a JSON preset" },
    { id: "presets:import-file", sectionId: "presets", sectionTitle: "Presets", label: "Import preset", description: "Import ATAK settings from a preset file or the library" },
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

/*
 * ATAK greys out a settings item while `disablePreferenceItem_<item>` is true and removes it while
 * `hidePreferenceItem_<item>` is true. Each mode writes both keys, so a group, role or member
 * mode always overrides the whole event's mode for the same item; "Normal" writes both as false,
 * which is also how a device is unlocked, because a .pref file cannot delete a key.
 */
export const DISABLE_PREFIX = "disablePreferenceItem_";
export const HIDE_PREFIX = "hidePreferenceItem_";
export type RestrictionMode = "normal" | "disabled" | "hidden";

export const RESTRICTION_MODES: Array<{ value: RestrictionMode; title: string }> = [
  { value: "normal", title: "Normal" },
  { value: "disabled", title: "Greyed out" },
  { value: "hidden", title: "Hidden" },
];

/** The settings item a key restricts, or `null` for any other key. */
export function restrictedItemOf(entry: Pick<AtakPreferenceEntryDto, "preference" | "key">): string | null {
  if (entry.preference !== APP_PREFERENCES) {
    return null;
  }
  if (entry.key.startsWith(DISABLE_PREFIX)) {
    return entry.key.slice(DISABLE_PREFIX.length);
  }
  return entry.key.startsWith(HIDE_PREFIX) ? entry.key.slice(HIDE_PREFIX.length) : null;
}

/** The item's mode for one target, or `null` when the target sends nothing for it. */
export function restrictionMode(entries: AtakPreferenceEntryDto[], target: PreferenceTarget, itemId: string): RestrictionMode | null {
  const disable = entries[entryIndex(entries, target, APP_PREFERENCES, DISABLE_PREFIX + itemId)]?.value;
  const hide = entries[entryIndex(entries, target, APP_PREFERENCES, HIDE_PREFIX + itemId)]?.value;
  if (hide === "true") {
    return "hidden";
  }
  if (disable === "true") {
    return "disabled";
  }
  return disable === undefined && hide === undefined ? null : "normal";
}

/** The list with one item's mode set for one target; `null` removes both keys. */
export function withRestriction(
  entries: AtakPreferenceEntryDto[],
  target: PreferenceTarget,
  itemId: string,
  mode: RestrictionMode | null,
): AtakPreferenceEntryDto[] {
  // Hidden also greys out, in case ATAK opens the item another way, such as from its settings search.
  const disable = mode === null ? null : String(mode !== "normal");
  const hide = mode === null ? null : String(mode === "hidden");
  const withDisable = withValue(entries, target, { key: DISABLE_PREFIX + itemId, type: "boolean" }, disable);
  return withValue(withDisable, target, { key: HIDE_PREFIX + itemId, type: "boolean" }, hide);
}

/** A settings item that can be locked: every catalog key and Core's extra screen items. */
export interface LockableItem {
  id: string;
  label: string;
  /** The catalog topic or the place in ATAK's settings. */
  area: string;
}

export function lockableItems(catalog: AtakPreferenceCatalogDto | null): LockableItem[] {
  const screenItems = (catalog?.screenItems ?? []).map((item: AtakScreenItemDto) => ({ id: item.id, label: item.description, area: item.area }));
  const keys = (catalog?.topics ?? []).flatMap((topic) => topic.keys.map((definition) => ({ id: definition.key, label: fieldLabel(definition), area: topic.title })));
  return [...screenItems, ...keys];
}
