import { describe, expect, it } from "vitest";
import { headingOf, type LiveMapItem } from "@/modules/editor/map/live-layer";

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
