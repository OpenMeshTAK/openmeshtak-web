import { afterEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { tacticalStyles } from "@/modules/editor/map/tactical-render";
import { renderTactical } from "@/modules/editor/map/tactical-render.worker";

describe("official tactical renderer adapter", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("sends cloneable reactive styles and invalidates cached replacement geometries", () => {
    const posted: unknown[] = [];
    vi.stubGlobal("Worker", class { postMessage(message: unknown) { posted.push(structuredClone(message)); } });
    const feature = new Feature(new LineString([[0, 0], [1, 1]]));
    const style = reactive({ color: "#123456", strokeWidth: 3, fillOpacity: 0, tacticalGraphic: { sidc: "11032500001403000000", modifiers: { T: "ALPHA" } } });
    tacticalStyles(feature, style, 2, true);
    tacticalStyles(feature, style, 2, true);
    expect(posted).toHaveLength(1);
    feature.setGeometry(new LineString([[0, 0], [2, 2]]));
    tacticalStyles(feature, style, 2, true);
    expect(posted).toHaveLength(2);
  });
  it("renders genuine phase-line geometry and designation instead of a marker", () => {
    const result = renderTactical({ id: 1, sidc: "11032500001403000000", coordinates: [[8, 50], [8.01, 50.01]], modifiers: { T: "ALPHA" }, color: "#123456", width: 4, scale: 50000 });
    expect(result.error).toBeNull();
    const geometry = JSON.parse(result.geojson!) as { features: Array<{ geometry: { type: string }; properties: { label?: string; strokeColor?: string } }> };
    expect(geometry.features.some((feature) => feature.geometry.type === "MultiLineString")).toBe(true);
    expect(geometry.features.some((feature) => feature.properties.label?.includes("ALPHA"))).toBe(true);
    expect(geometry.features.some((feature) => feature.properties.strokeColor === "#123456")).toBe(true);
  });
  it("renders assembly-area and advance-axis geometry with bounded output", () => {
    for (const sidc of ["11032500001502000000", "11032500001514040000"]) {
      const result = renderTactical({ id: 2, sidc, coordinates: [[8, 50], [8.01, 50.01], [8.02, 50]], modifiers: {}, color: "#123456", width: 3, scale: 50000 });
      expect(result.error).toBeNull();
      expect(result.geojson!.length).toBeLessThan(2000000);
    }
  });
});
