import { describe, expect, it } from "vitest";
import Polygon from "ol/geom/Polygon";
import { constrainRectangleCorners } from "@/modules/editor/map/shape-editing";

const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
const ring = (corners: number[][]) => new Polygon([[...corners, corners[0]!]]);
const corners = (polygon: Polygon) => polygon.getCoordinates()[0]!.slice(0, 4).map((p) => p.map((value) => Math.round(value * 1000) / 1000));

describe("rectangle constraint", () => {
  it("keeps the opposite corner and right angles when a corner is dragged", () => {
    const dragged = ring([[0, 0], [100, 0], [150, 130], [0, 100]]);
    expect(corners(constrainRectangleCorners(dragged, square))).toEqual([[0, 0], [150, 0], [150, 130], [0, 130]]);
  });

  it("moves a dragged edge only across itself", () => {
    const dragged = ring([[0, 0], [130, 20], [130, 120], [0, 100]]);
    expect(corners(constrainRectangleCorners(dragged, square))).toEqual([[0, 0], [130, 0], [130, 100], [0, 100]]);
  });

  it("leaves a translated rectangle unchanged", () => {
    const moved = ring(square.map(([x, y]) => [x! + 10, y! + 5]));
    expect(corners(constrainRectangleCorners(moved, square))).toEqual([[10, 5], [110, 5], [110, 105], [10, 105]]);
  });
});
