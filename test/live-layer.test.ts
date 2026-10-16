import { describe, expect, it } from "vitest";
import { headingOf, LABEL_MIN_ZOOM, showsLabel, type LiveMapItem } from "@/modules/editor/map/live-layer";

const item: LiveMapItem = { uid: "A", type: "a-f-G-U-C", callsign: "ALPHA", lat: 52, lon: 13 };

describe("live map direction arrow", () => {
  it("points along the course of a moving item", () => {
    expect(headingOf({ ...item, course: 271.5, speed: 1.4 })).toBe(271.5);
    expect(headingOf({ ...item, course: 90, speed: null })).toBe(90);
  });

  it("hides the arrow when standing still, outdated or without a course", () => {
    expect(headingOf({ ...item, course: 0, speed: 0 })).toBeNull();
    expect(headingOf({ ...item, course: 90, speed: 3, outdated: true })).toBeNull();
    expect(headingOf(item)).toBeNull();
  });
});

describe("live map labels", () => {
  const resolutionAt = (zoom: number): number => 156_543.033_928_041 / 2 ** zoom;

  it("shows labels only from the zoom level on in auto mode", () => {
    expect(showsLabel("auto", resolutionAt(LABEL_MIN_ZOOM - 1), false)).toBe(false);
    expect(showsLabel("auto", resolutionAt(LABEL_MIN_ZOOM), false)).toBe(true);
    expect(showsLabel("auto", resolutionAt(LABEL_MIN_ZOOM + 3), false)).toBe(true);
  });

  it("shows them always or never as chosen", () => {
    expect(showsLabel("always", resolutionAt(5), false)).toBe(true);
    expect(showsLabel("off", resolutionAt(18), false)).toBe(false);
  });

  it("always labels the selected item", () => {
    expect(showsLabel("auto", resolutionAt(5), true)).toBe(true);
    expect(showsLabel("off", resolutionAt(5), true)).toBe(true);
  });
});
