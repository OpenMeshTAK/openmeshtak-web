import Polygon from "ol/geom/Polygon";
import type { GeometryFunction } from "ol/interaction/Draw";
import { getPointResolution, toLonLat } from "ol/proj";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";
import { ellipsePolygon } from "./shape-editing";
import { squareDrawingCoordinates } from "./rectangle-drawing";

type EllipseGeometry = Extract<PackageGeometry, { type: "Ellipse" }>;

/** The same parametric ellipse drives both the live outline and the object saved on completion. */
export function createEllipseDrawing(circle: () => boolean = () => false): { geometryFunction: GeometryFunction; current: () => EllipseGeometry | null } {
  let current: EllipseGeometry | null = null;
  const geometryFunction: GeometryFunction = (coordinates, geometry) => {
    // Circle-mode Draw supplies the first click and the moving opposite corner.
    const points = circle() ? squareDrawingCoordinates(coordinates as number[][]) : coordinates as number[][];
    const first = points[0] ?? [0, 0];
    const last = points.at(-1) ?? first;
    const centre = [((first[0] ?? 0) + (last[0] ?? 0)) / 2, ((first[1] ?? 0) + (last[1] ?? 0)) / 2];
    const scale = getPointResolution("EPSG:3857", 1, centre, "m");
    const horizontal = Math.abs((last[0] ?? 0) - (first[0] ?? 0)) * scale / 2;
    const vertical = Math.abs((last[1] ?? 0) - (first[1] ?? 0)) * scale / 2;
    current = {
      type: "Ellipse", coordinates: toLonLat(centre).slice(0, 2),
      major: Math.max(0.1, horizontal, vertical), minor: Math.max(0.1, Math.min(horizontal, vertical)),
      rotation: horizontal >= vertical ? 90 : 0,
    };
    const outline = ellipsePolygon(current);
    if (geometry instanceof Polygon) {
      geometry.setCoordinates(outline.getCoordinates());
      return geometry;
    }
    return outline;
  };
  return { geometryFunction, current: () => current };
}
