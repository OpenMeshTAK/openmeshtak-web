import { describe, expect, it } from "vitest";
import { fromLonLat } from "ol/proj";
import { sectorFromHandle, sectorHandles } from "@/modules/editor/map/sector-editor";

const centre = fromLonLat([10, 53]);
const sector = { heading: 45, sweep: 60, radius: 1000 };

describe("sector handles", () => {
  it("returns the same sector when a handle is dropped where it started", () => {
    for (const { handle, position } of sectorHandles(centre, sector)) {
      const result = sectorFromHandle(centre, sector, handle, position);
      expect(result.heading).toBeCloseTo(45, 0);
      expect(result.sweep).toBeCloseTo(60, 0);
      expect(result.radius).toBeCloseTo(1000, -1);
    }
  });

  it("rotates the heading and snaps to 15° with Shift", () => {
    const east = [centre[0]! + 5000, centre[1]!];
    expect(sectorFromHandle(centre, sector, "rotation", east).heading).toBe(90);
    const nearEast = [centre[0]! + 5000, centre[1]! + 400];
    expect(sectorFromHandle(centre, sector, "rotation", nearEast, true).heading).toBe(90);
  });

  it("keeps sweep and radius within the API limits", () => {
    const behind = [centre[0]! - 3000, centre[1]! - 3000];
    expect(sectorFromHandle(centre, sector, "sweep", behind).sweep).toBe(360);
    expect(sectorFromHandle(centre, sector, "radius", centre).radius).toBe(0.1);
  });
});
