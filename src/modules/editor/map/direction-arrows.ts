import LineString from "ol/geom/LineString";
import Polygon from "ol/geom/Polygon";
import { Fill, Stroke, Style } from "ol/style";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";

interface Segment { start: number[]; end: number[]; length: number }

function segmentsOf(line: LineString): Segment[] {
  const segments: Segment[] = [];
  line.forEachSegment((start, end) => {
    const length = Math.hypot((end[0] ?? 0) - (start[0] ?? 0), (end[1] ?? 0) - (start[1] ?? 0));
    if (length > 0) segments.push({ start, end, length });
  });
  return segments;
}

/** Screen-sized arrowheads use the line tangent; repeated vertices have no direction. */
function head(tip: number[], segment: Segment, size: number, reverse = false): Polygon {
  const sign = reverse ? -1 : 1;
  const ux = sign * ((segment.end[0] ?? 0) - (segment.start[0] ?? 0)) / segment.length;
  const uy = sign * ((segment.end[1] ?? 0) - (segment.start[1] ?? 0)) / segment.length;
  const x = tip[0] ?? 0;
  const y = tip[1] ?? 0;
  const halfWidth = size * 0.45;
  return new Polygon([[[x, y], [x - ux * size - uy * halfWidth, y - uy * size + ux * halfWidth],
    [x - ux * size + uy * halfWidth, y - uy * size - ux * halfWidth], [x, y]]]);
}

/** Spacing is in screen pixels. Bound decoration work even for very long routes at high zoom. */
export function directionArrowGeometries(line: LineString, kind: string, style: PackageObjectStyle, resolution: number): Polygon[] {
  if (!(resolution > 0)) return [];
  if (kind !== "line" && kind !== "route") return [];
  if (kind === "line" && (style.arrowHeads ?? "none") === "none") return [];
  if (kind === "route" && style.routeDirectionArrows !== true) return [];
  const segments = segmentsOf(line);
  const first = segments[0];
  const last = segments.at(-1);
  if (first === undefined || last === undefined) return [];
  const size = (style.arrowHeadSize ?? 16) * resolution;
  const heads: Polygon[] = [];
  if (kind === "line") {
    const fraction = first === last && style.arrowHeads === "both" ? 0.5 : 1;
    if (style.arrowHeads === "start" || style.arrowHeads === "both") heads.push(head(first.start, first, Math.min(size, first.length * fraction), true));
    if (style.arrowHeads === "end" || style.arrowHeads === "both") heads.push(head(last.end, last, Math.min(size, last.length * fraction)));
  }
  if (kind === "route" && style.routeDirectionArrows === true) {
    const total = segments.reduce((length, segment) => length + segment.length, 0);
    const spacing = Math.max((style.routeArrowSpacing ?? 80) * resolution, total / 256);
    let distance = spacing / 2;
    let offset = 0;
    for (const segment of segments) {
      while (distance < offset + segment.length && distance < total && heads.length < 256) {
        const fraction = (distance - offset) / segment.length;
        const tip = [(segment.start[0] ?? 0) + ((segment.end[0] ?? 0) - (segment.start[0] ?? 0)) * fraction,
          (segment.start[1] ?? 0) + ((segment.end[1] ?? 0) - (segment.start[1] ?? 0)) * fraction];
        heads.push(head(tip, segment, size));
        distance += spacing;
      }
      offset += segment.length;
    }
  }
  return heads;
}

/** Clip only the painted shaft to head bases. Canonical endpoints and editing handles stay intact. */
export function directionShaftGeometry(line: LineString, style: PackageObjectStyle, resolution: number): LineString {
  const heads = directionArrowGeometries(line, "line", style, resolution);
  if (heads.length === 0) return line;
  const points = line.getCoordinates();
  const equal = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
  while (points.length > 2 && equal(points[0]!, points[1]!)) points.shift();
  while (points.length > 2 && equal(points.at(-1)!, points.at(-2)!)) points.pop();
  const base = (geometry: Polygon) => { const ring = geometry.getCoordinates()[0]!; return [(ring[1]![0]! + ring[2]![0]!) / 2, (ring[1]![1]! + ring[2]![1]!) / 2]; };
  if (style.arrowHeads === "start" || style.arrowHeads === "both") points[0] = base(heads[0]!);
  if (style.arrowHeads === "end" || style.arrowHeads === "both") points[points.length - 1] = base(heads.at(-1)!);
  return new LineString(points);
}

export function directionArrowStyles(line: LineString, kind: string, style: PackageObjectStyle, resolution: number, zIndex: number, selected = false): Style[] {
  return directionArrowGeometries(line, kind, style, resolution).flatMap((geometry) => [
    ...(selected || style.strokeStyle === "outlined" ? [new Style({ geometry, fill: new Fill({ color: "#FFFFFF" }), stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: 3, lineJoin: "miter" }), zIndex })] : []),
    new Style({ geometry, fill: new Fill({ color: style.color }), zIndex: zIndex + 1 }),
  ]);
}
