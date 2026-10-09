/**
 * Search over the settings of one settings view, such as an event's TAK or Meshtastic settings.
 * Each feature module builds the entries from what it already fetched; this module only matches
 * text, so it never sees stored values or secrets.
 */
export interface SettingsSearchEntry {
  /** Unique within the view, e.g. `tak:coord_display_pref`; also the field's anchor. */
  id: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  description?: string | undefined;
  /** The technical key, such as an ATAK preference key or a firmware field path. */
  key?: string | undefined;
  /** Labels of the values a list offers. */
  options?: string[] | undefined;
  /** Hidden until the operator shows advanced settings; navigating there reveals them. */
  advanced?: boolean | undefined;
}

/** One navigation entry of a settings view. */
export interface SettingsSection {
  id: string;
  title: string;
  description?: string | undefined;
  icon: string;
  /** Menu group such as "Setup"; consecutive sections with the same group share a heading. */
  group: string;
  /** Short text at the end of the menu entry, such as a firmware version. */
  badge?: string | undefined;
  /** Marks a section that holds invalid settings. */
  problem?: boolean | undefined;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s._-]+/g, " ").trim();
}

function texts(entry: SettingsSearchEntry): string[] {
  return [entry.label, entry.description ?? "", entry.key ?? "", entry.sectionTitle, ...(entry.options ?? [])];
}

/**
 * Entries whose label, description, key, section or option labels contain every word of the
 * query, case-insensitive. Label matches come first, then the view's own order.
 */
export function searchSettings(entries: SettingsSearchEntry[], query: string): SettingsSearchEntry[] {
  const words = normalize(query).split(" ").filter((word) => word !== "");
  if (words.length === 0) {
    return [];
  }
  const matches = entries.filter((entry) => {
    const haystack = texts(entry).map(normalize).join("\n");
    return words.every((word) => haystack.includes(word));
  });
  const inLabel = (entry: SettingsSearchEntry) => words.every((word) => normalize(entry.label).includes(word));
  return [...matches.filter(inLabel), ...matches.filter((entry) => !inLabel(entry))];
}

/** Results grouped by section, in the order the sections appear in the menu. */
export function groupResults(
  results: SettingsSearchEntry[],
  sections: SettingsSection[],
): Array<{ section: SettingsSection; entries: SettingsSearchEntry[] }> {
  return sections
    .map((section) => ({ section, entries: results.filter(({ sectionId }) => sectionId === section.id) }))
    .filter(({ entries }) => entries.length > 0);
}
