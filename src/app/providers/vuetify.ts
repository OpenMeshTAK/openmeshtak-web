import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import "vuetify/styles";
import { readThemePreference } from "@/shared/composables/useThemePreference";

/**
 * One OpenMeshTak theme with semantic colors (primary, success, warning, error). TAK team colors
 * are event data and must never be used as UI semantics such as the primary color.
 */
export const vuetify = createVuetify({
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  theme: {
    defaultTheme: readThemePreference(),
    themes: {
      light: {
        dark: false,
        colors: {
          background: "#F5F6F8",
          surface: "#FFFFFF",
          primary: "#1F5FA8",
          secondary: "#4A5568",
          success: "#2E7D32",
          warning: "#9A5B00",
          error: "#C62828",
          info: "#0277BD",
        },
      },
      dark: {
        dark: true,
        colors: {
          background: "#111418",
          surface: "#1A1F25",
          primary: "#7FB0E8",
          secondary: "#A0AEC0",
          success: "#81C784",
          warning: "#FFB74D",
          error: "#EF9A9A",
          info: "#81D4FA",
        },
      },
    },
  },
  defaults: {
    VBtn: { rounded: "lg", variant: "flat" },
    VCard: { rounded: "xl", variant: "flat", border: true },
    VTextField: { variant: "outlined", density: "comfortable", color: "primary" },
    VSelect: { variant: "outlined", density: "comfortable", color: "primary" },
    VTextarea: { variant: "outlined", density: "comfortable", color: "primary" },
    VAlert: { variant: "tonal", rounded: "lg" },
    // Short slide-and-fade tab panels, see src/app/styles/transitions.css.
    VWindowItem: { transition: "tab-panel-forward", reverseTransition: "tab-panel-back" },
  },
});
