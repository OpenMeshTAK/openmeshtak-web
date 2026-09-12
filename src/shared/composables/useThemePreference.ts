import { computed } from "vue";
import { useTheme } from "vuetify";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "openmeshtak.theme";
const order: ThemePreference[] = ["system", "light", "dark"];

/** Per-browser convenience only; storage may be unavailable, so every access is guarded. */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return order.includes(stored as ThemePreference) ? (stored as ThemePreference) : "system";
  } catch {
    return "system";
  }
}

function storeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Without storage the choice simply lasts for this page view.
  }
}

export function useThemePreference() {
  const theme = useTheme();
  const preference = computed<ThemePreference>(() =>
    theme.isSystem.value ? "system" : (theme.name.value as ThemePreference),
  );

  async function cycle(): Promise<void> {
    const next = order[(order.indexOf(preference.value) + 1) % order.length] ?? "system";
    storeThemePreference(next);
    await theme.change(next);
  }

  return { preference, cycle };
}
