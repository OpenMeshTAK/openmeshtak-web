import { describe, expect, it } from "vitest";
import { anchorOf, moveGeometry } from "@/modules/editor/map/move-geometry";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";

describe("moving geometry for paste", () => {
  it("puts the bounding-box centre under the cursor and keeps the shape", () => {
    const square: PackageGeometry = { type: "Polygon", coordinates: [[[8, 50], [8.2, 50], [8.2, 50.2], [8, 50.2], [8, 50]]] };
    const moved = moveGeometry(square, [9.1, 51.1]);
    expect(anchorOf(moved)[0]).toBeCloseTo(9.1);
    expect(anchorOf(moved)[1]).toBeCloseTo(51.1);
    expect(moved.type === "Polygon" ? moved.coordinates[0]?.length : 0).toBe(5);
  });

  it("drops altitudes that no longer apply and keeps circle radii", () => {
    expect(moveGeometry({ type: "Point", coordinates: [8, 50, 112] }, [9, 51])).toEqual({ type: "Point", coordinates: [9, 51] });
    expect(moveGeometry({ type: "Circle", coordinates: [8, 50, 80], radius: 46.38 }, [9, 51])).toEqual({
      type: "Circle",
      coordinates: [9, 51],
      radius: 46.38,
    });
  });
});
