import { describe, expect, it } from "vitest";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import Circle from "ol/geom/Circle";
import { fromLonLat } from "ol/proj";
import { fromMgrs, fromUtm, toMgrs, toUtm } from "@/modules/editor/map/coordinate-input";
import { distanceInUnit, formatBearing, rangeBearingLabel, trueBearing } from "@/modules/editor/map/range-bearing";
import { planningMapFootprint } from "@/modules/editor/map/planning-geometry";
import { planningOverlayStyles } from "@/modules/editor/map/planning-overlays";
import { objectStyle } from "@/modules/editor/map/object-style";

const style = { color: "#123456", strokeWidth: 3, fillOpacity: 0.3 };
describe("planning inputs and overlays", () => {
  it("round-trips UTM WGS84 including Norway/Svalbard and southern hemisphere", () => {
    for (const coordinates of [[8.682127, 50.110924], [6, 60], [20, 78], [18.4, -33.9]]) {
      const projected = toUtm(coordinates), decoded = fromUtm(projected);
      expect(decoded[0]).toBeCloseTo(coordinates[0]!, 8);
      expect(decoded[1]).toBeCloseTo(coordinates[1]!, 8);
    }
    expect(toUtm([6, 60]).zone).toBe(32);
    expect(toUtm([20, 78]).zone).toBe(33);
    expect(() => fromUtm({ zone: 0, hemisphere: "N", easting: 500000, northing: 0 })).toThrow();
    expect(() => toUtm([8, 85])).toThrow();
  });
  it("uses explicit MGRS cell centres and reports resolution", () => {
    const coordinates = [8.682127, 50.110924];
    const encoded = toMgrs(coordinates), decoded = fromMgrs(encoded);
    expect(decoded.resolution).toBe(1);
    expect(Math.abs(decoded.position[0]! - coordinates[0]!)).toBeLessThan(0.00002);
    expect(Math.abs(decoded.position[1]! - coordinates[1]!)).toBeLessThan(0.00002);
    expect(fromMgrs(encoded.slice(0, 5)).resolution).toBe(100000);
    for (const input of ["99UAA0000000000", "32UAA123", "garbage", "32IAA12341234"]) expect(() => fromMgrs(input)).toThrow();
  });
  it("uses ellipsoidal distance, true north and exact unit conversions", () => {
    expect(trueBearing([[0, 0], [1, 0]])).toBeCloseTo(90, 8);
    expect(trueBearing([[0, 0], [0, 1]])).toBeCloseTo(0, 8);
    expect(trueBearing([[0, 0], [0, 0]])).toBeNull();
    expect(distanceInUnit(1852, "nm")).toBe("1.000 nm");
    expect(formatBearing(90, "mils")).toBe("1600.0 mils");
    const line = new LineString([[0, 0], [1, 0]].map((p) => fromLonLat(p)));
    expect(rangeBearingLabel(line, "m")).toContain("111319.5 m");
  });
  it("recomputes sectors/corridors from changed live geometry", () => {
    const point = new Point(fromLonLat([8, 50]));
    const sector = { ...style, sector: { heading: 90, sweep: 60, radius: 100 } };
    const first = planningMapFootprint(point, sector);
    expect(planningMapFootprint(point, sector)).toBe(first);
    point.translate(100, 0);
    expect(planningMapFootprint(point, sector)).not.toBe(first);
    expect(planningMapFootprint(point, { ...sector, sector: { ...sector.sector, radius: 200 } })).not.toBe(first);
  });
  it("renders range/bullseye overlays and respects label visibility and outlines", () => {
    const circle = new Feature(new Circle(fromLonLat([8, 50]), 150));
    const rings = { ...style, rangeCircle: true, rangeRings: 3 };
    expect(planningOverlayStyles(circle, rings, false, false)).toHaveLength(3);
    const overlays = planningOverlayStyles(circle, rings, false, false);
    circle.setGeometry(new Circle(fromLonLat([9, 50]), 150));
    expect(planningOverlayStyles(circle, rings, false, false)).not.toBe(overlays);
    expect(planningOverlayStyles(circle, { ...style, bullseye: { ringDistance: 50, ringCount: 3, ringsVisible: true, edgeToCenter: false } }, false, false)).toHaveLength(15);
    const point = new Feature(new Point(fromLonLat([8, 50])));
    point.setProperties({ kind: "point", name: "Name", cotType: null, iconsetPath: null, objectStyle: { ...style, labelVisible: false, label: { text: "Exact", fontSize: 16, alignment: "center", background: null } } });
    expect(objectStyle(point, 1, false)[0]!.getText()).toBeNull();
    const line = new Feature(new LineString([[0, 0], [1, 1]]));
    line.setProperties({ kind: "line", objectStyle: { ...style, strokeStyle: "outlined" } });
    expect(objectStyle(line, 1, false)).toHaveLength(2);
  });
});
