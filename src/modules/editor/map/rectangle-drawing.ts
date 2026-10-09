import { createBox, type GeometryFunction } from "ol/interaction/Draw";

/** Keep the first corner fixed and extend the shorter dimension in the pointer's quadrant. */
export function squareDrawingCoordinates(coordinates: number[][]): number[][] {
  const first = coordinates[0] ?? [0, 0];
  const last = coordinates.at(-1) ?? first;
  const x = (last[0] ?? 0) - (first[0] ?? 0);
  const y = (last[1] ?? 0) - (first[1] ?? 0);
  const side = Math.max(Math.abs(x), Math.abs(y));
  return [first, [(first[0] ?? 0) + (x < 0 ? -side : side), (first[1] ?? 0) + (y < 0 ? -side : side)]];
}

export function createRectangleDrawing(square: () => boolean): GeometryFunction {
  const box = createBox();
  return (coordinates, geometry, projection) => box(square() ? squareDrawingCoordinates(coordinates as number[][]) : coordinates, geometry, projection);
}
