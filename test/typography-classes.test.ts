import { describe, expect, it } from "vitest";

/**
 * Vuetify 4 ships only the Material Design 3 type scale (`text-headline-small`, `text-title-medium`,
 * `text-body-medium`, ...). The Material Design 2 names still look like valid classes, so they fail
 * silently and leave text at the browser default size and margins.
 */
const legacyTypography = /\btext-(?:h[1-6]|subtitle-[12]|body-[12]|caption|overline|button)\b/g;

const sources = import.meta.glob<string>("../src/**/*.{vue,ts}", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("typography classes", () => {
  it("uses only the Vuetify 4 type scale", () => {
    const offenders = Object.entries(sources).flatMap(([file, source]) =>
      [...source.matchAll(legacyTypography)].map((match) => `${file}: ${match[0]}`),
    );

    expect(Object.keys(sources).length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
