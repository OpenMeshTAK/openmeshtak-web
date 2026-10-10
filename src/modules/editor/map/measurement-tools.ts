import type Feature from "ol/Feature";
import type { FeatureLike } from "ol/Feature";
import type OlMap from "ol/Map";
import type Geometry from "ol/geom/Geometry";
import Polygon from "ol/geom/Polygon";
import LineString from "ol/geom/LineString";
import { Draw } from "ol/interaction";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { getArea, getLength } from "ol/sphere";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import { EndpointDraw } from "./endpoint-draw";
import { rangeBearingLabel, type DistanceUnit } from "./range-bearing";

export type MeasurementTool = "measure-length" | "measure-area" | "measure-bearing";

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${metres.toFixed(1)} m`;
}
export function formatArea(squareMetres: number): string {
  return squareMetres >= 1_000_000 ? `${(squareMetres / 1_000_000).toFixed(2)} km²` : squareMetres >= 10000 ? `${(squareMetres / 10000).toFixed(2)} ha` : `${squareMetres.toFixed(1)} m²`;
}
export function measurementLabel(geometry: Geometry): string {
  return geometry instanceof Polygon ? `${formatArea(getArea(geometry))}\nPerimeter ${formatDistance(getLength(geometry))}` : formatDistance(getLength(geometry));
}

function measurementStyle(feature: Feature<Geometry>, unit: DistanceUnit): Style {
  const geometry = feature.getGeometry();
  const text = feature.get("rangeBearing") === true && geometry instanceof LineString ? rangeBearingLabel(geometry, unit) : geometry === undefined ? "" : measurementLabel(geometry);
  return new Style({
    stroke: new Stroke({ color: "#FFB300", width: 3, lineDash: [8, 5] }),
    fill: new Fill({ color: "rgba(255, 179, 0, 0.15)" }),
    image: new Circle({ radius: 5, fill: new Fill({ color: "#FFB300" }), stroke: new Stroke({ color: "#FFFFFF", width: 2 }) }),
    ...(geometry instanceof Polygon || geometry instanceof LineString ? { text: new Text({ text, font: "600 13px Roboto, Arial, sans-serif", fill: new Fill({ color: "#1A1A1A" }), backgroundFill: new Fill({ color: "rgba(255, 255, 255, 0.95)" }), padding: [4, 6, 4, 6], overflow: true }) } : {}),
  });
}

/** Local overlays only: measuring never invokes an editor save or a domain API. */
export class MeasurementTools {
  private readonly source = new VectorSource<Feature<Geometry>>();
  private draw: Draw | null = null;
  private unit: DistanceUnit = "m";
  constructor(private readonly map: OlMap) {
    map.addLayer(new VectorLayer({ source: this.source, style: (feature) => measurementStyle(feature as Feature<Geometry>, this.unit) }));
  }
  setTool(tool: MeasurementTool | null): void {
    if (this.draw !== null) { this.draw.abortDrawing(); this.map.removeInteraction(this.draw); this.draw = null; }
    if (tool === null) return;
    const options = { source: this.source, stopClick: true, freehandCondition: () => false, style: (feature: FeatureLike) => measurementStyle(feature as Feature<Geometry>, this.unit) };
    this.draw = tool === "measure-bearing" ? new Draw({ ...options, type: "LineString", maxPoints: 2 }) : tool === "measure-length" ? new EndpointDraw({ ...options, type: "LineString" }) : new Draw({ ...options, type: "Polygon" });
    this.draw.on("drawstart", (event) => event.feature.set("rangeBearing", tool === "measure-bearing"));
    this.map.addInteraction(this.draw);
  }
  clear(): void { this.draw?.abortDrawing(); this.source.clear(); }
  setUnit(unit: DistanceUnit): void { this.unit = unit; this.source.changed(); }
}
