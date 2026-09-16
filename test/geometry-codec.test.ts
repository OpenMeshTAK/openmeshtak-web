import { describe, expect, it } from "vitest";
import type LineString from "ol/geom/LineString";
import { fromMapGeometry, toMapGeometry } from "@/modules/editor/map/geometry-codec";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";

describe("data package geometry codec", () => {
  const line: PackageGeometry = { type: "LineString", coordinates: [[8.682127, 50.110924, 112.5], [8.7, 50.12]] };

  it("returns the exact original coordinates and altitude for unmoved vertices", () => {
    expect(fromMapGeometry(toMapGeometry(line), line)).toEqual(line);
  });

  it("leaves the altitude of new vertices unknown instead of zero", () => {
    const mapLine = toMapGeometry(line) as LineString;
    const [first, second] = mapLine.getCoordinates();
    mapLine.setCoordinates([first ?? [], second ?? [], [(second?.[0] ?? 0) + 1000, second?.[1] ?? 0]]);

    const edited = fromMapGeometry(mapLine, line);
    expect(edited.type).toBe("LineString");
    const positions = edited.coordinates as number[][];
    expect(positions[0]).toEqual([8.682127, 50.110924, 112.5]);
    expect(positions[2]).toHaveLength(2);
  });

  it("keeps circles in metres through the Web Mercator map", () => {
    const circle: PackageGeometry = { type: "Circle", coordinates: [11.8144873, 52.383763, 81.9], radius: 46.38 };
    expect(fromMapGeometry(toMapGeometry(circle), circle)).toEqual(circle);
  });
});
