import { describe, expect, it } from "vitest";
import { gridSpacing, mgrsGrid } from "@/modules/editor/map/mgrs-grid";

describe("MGRS grid", () => {
  it("chooses the finest readable spacing", () => {
    expect(gridSpacing(1)).toBe(100);
    expect(gridSpacing(10)).toBe(1_000);
    expect(gridSpacing(100)).toBe(10_000);
    expect(gridSpacing(1_000)).toBe(100_000);
    expect(gridSpacing(5_000)).toBeNull();
  });

  it("shows only zone designators when zoomed far out", () => {
    const { lines, labels } = mgrsGrid([0, 40, 30, 60], 5_000);
    expect(lines.every(({ level }) => level === "zone")).toBe(true);
    expect(labels.map(({ text }) => text)).toContain("32U");
  });

  it("labels 100 km squares only at 100 km spacing", () => {
    // Bad Oldesloe lies in 32U NE.
    expect(mgrsGrid([9, 53, 12, 54.5], 1_000).labels.some(({ text }) => text === "32U NE")).toBe(true);
    expect(mgrsGrid([10.33, 53.78, 10.42, 53.82], 10).labels.some(({ anchor }) => anchor === "centre")).toBe(false);
  });

  it("labels 1 km lines with two digits", () => {
    const { lines, labels } = mgrsGrid([10.33, 53.78, 10.42, 53.82], 10);
    expect(lines.some(({ level }) => level === "line")).toBe(true);
    expect(labels.filter(({ anchor }) => anchor === "bottom").every(({ text }) => /^\d{2}$/.test(text))).toBe(true);
  });

  it("stops lines at the zone boundary", () => {
    const { lines } = mgrsGrid([11.9, 53.8, 12.1, 53.9], 10);
    const fine = lines.filter(({ level }) => level !== "zone");
    expect(fine.every(({ positions }) => positions.every(([lon]) => lon! <= 12 + 1e-6) || positions.every(([lon]) => lon! >= 12 - 1e-6))).toBe(true);
  });
});
