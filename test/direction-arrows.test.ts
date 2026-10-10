import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { describe, expect, it } from "vitest";
import { directionArrowGeometries, directionShaftGeometry } from "@/modules/editor/map/direction-arrows";
import { objectStyle } from "@/modules/editor/map/object-style";

const style = { color: "#123456", strokeWidth: 3, fillOpacity: 0, arrowHeadSize: 10 };

describe("direction arrow rendering", () => {
  it("uses the first and last non-zero tangents, facing outward", () => {
    const line = new LineString([[0, 0], [0, 0], [100, 0], [100, 100], [100, 100]]);
    const heads = directionArrowGeometries(line, "line", { ...style, arrowHeads: "both" }, 1);
    expect(heads.map((head) => head.getCoordinates()[0]?.[0])).toEqual([[0, 0], [100, 100]]);
    expect(heads[0]?.getExtent()).toEqual([0, -4.5, 10, 4.5]);
    expect(heads[1]?.getExtent()).toEqual([95.5, 90, 104.5, 100]);
  });

  it("keeps head size in pixels when zoom changes", () => {
    const line = new LineString([[0, 0], [100, 0]]);
    const head = directionArrowGeometries(line, "line", { ...style, arrowHeads: "end" }, 2)[0];
    expect(head?.getExtent()).toEqual([80, -9, 100, 9]);
  });

  it("keeps tips on diagonal endpoints while the selected shaft stops at head bases", () => {
    const line = new LineString([[10, 20], [10, 20], [90, 80], [90, 80]]);
    const original = line.getCoordinates();
    const decorated = { ...style, arrowHeads: "both" as const };
    expect(directionArrowGeometries(line, "line", decorated, 1).map((head) => head.getCoordinates()[0]![0])).toEqual([[10, 20], [90, 80]]);
    expect(directionShaftGeometry(line, decorated, 1).getCoordinates()).toEqual([[18, 26], [82, 74]]);
    const feature = new Feature(line);
    feature.setProperties({ kind: "line", objectStyle: decorated, name: "Arrow" });
    const selected = objectStyle(feature, 1, true);
    expect(selected[0]!.getStroke()!.getLineCap()).toBe("butt");
    expect((selected[0]!.getGeometry() as LineString).getCoordinates()).toEqual([[18, 26], [82, 74]]);
    expect(line.getCoordinates()).toEqual(original);
    const short = new LineString([[0, 0], [2, 0]]);
    expect(directionShaftGeometry(short, decorated, 1).getCoordinates()).toEqual([[1, 0], [1, 0]]);
  });

  it("spaces route directions across corners, following point order without changing coordinates", () => {
    const line = new LineString([[0, 0], [100, 0], [100, 100]]);
    const before = line.getCoordinates();
    const heads = directionArrowGeometries(line, "route", { ...style, routeDirectionArrows: true, routeArrowSpacing: 50 }, 1);
    expect(heads.map((head) => head.getCoordinates()[0]?.[0])).toEqual([[25, 0], [75, 0], [100, 25], [100, 75]]);
    expect(heads[2]?.getExtent()).toEqual([95.5, 15, 104.5, 25]);
    expect(line.getCoordinates()).toEqual(before);
  });

  it("does not decorate ordinary lines, disabled routes or degenerate geometry", () => {
    const line = new LineString([[0, 0], [100, 0]]);
    expect(directionArrowGeometries(line, "line", style, 1)).toEqual([]);
    expect(directionArrowGeometries(line, "route", { ...style, arrowHeads: "both" }, 1)).toEqual([]);
    expect(directionArrowGeometries(new LineString([[0, 0], [0, 0]]), "line", { ...style, arrowHeads: "both" }, 1)).toEqual([]);
  });

  it("bounds decoration count for very long routes", () => {
    const line = new LineString([[0, 0], [1e8, 0]]);
    expect(directionArrowGeometries(line, "route", { ...style, routeDirectionArrows: true }, 0.1)).toHaveLength(256);
  });

  it("invalidates cached arrow styles on zoom and geometry edits", () => {
    const feature = new Feature(new LineString([[0, 0], [100, 0]]));
    feature.setProperties({ kind: "line", objectStyle: { ...style, arrowHeads: "end" }, name: "Arrow" });
    const initial = objectStyle(feature, 1, false);
    expect(objectStyle(feature, 1, false)).toBe(initial);
    const zoomed = objectStyle(feature, 2, false);
    expect(zoomed).not.toBe(initial);
    feature.getGeometry()?.setCoordinates([[0, 0], [200, 0]]);
    expect(objectStyle(feature, 2, false)).not.toBe(zoomed);
  });
});
