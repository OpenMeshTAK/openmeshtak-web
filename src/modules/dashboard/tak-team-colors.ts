import type { Schemas } from "@/shared/api/types";

type TakTeam = Schemas["TakTeam"];

/**
 * Approximate swatches for ATAK team colors. Display only: the team name is always shown as text
 * next to the swatch, and these colors never replace the UI's semantic colors.
 */
export const takTeamSwatches: Record<TakTeam, string> = {
  White: "#FFFFFF",
  Yellow: "#FFEB3B",
  Orange: "#FF9800",
  Magenta: "#E91E63",
  Red: "#F44336",
  Maroon: "#800000",
  Purple: "#9C27B0",
  "Dark Blue": "#1A237E",
  Blue: "#2196F3",
  Cyan: "#00BCD4",
  Teal: "#009688",
  Green: "#4CAF50",
  "Dark Green": "#1B5E20",
  Brown: "#795548",
};
