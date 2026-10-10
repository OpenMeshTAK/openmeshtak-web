import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";
type Route = Extract<PackageGeometry, { type: "Route" }>;

export function newRoute(coordinates: number[][]): Route {
  return { type: "Route", coordinates,
    points: coordinates.map((_, index) => ({ id: crypto.randomUUID(), type: index === 0 || index === coordinates.length - 1 ? "waypoint" : "checkpoint", name: index === 0 ? "Start" : index === coordinates.length - 1 ? "Finish" : "", remarks: "" })),
    // Defaults of a new ATAK-CIV route (5.6 export): `type` is a localized transport label ATAK fills itself.
    options: { method: "Walking", direction: "Infil", routeType: "Primary", order: "Ascending Check Points", planningMethod: "Infil", prefix: "CP" }, navigationCues: [],
  };
}

export function copyGeometry(geometry: PackageGeometry): PackageGeometry {
  if (geometry.type !== "Route") return geometry;
  const ids = new Map(geometry.points.map((point) => [point.id, crypto.randomUUID()]));
  return { ...geometry, points: geometry.points.map((point) => ({ ...point, id: ids.get(point.id) ?? point.id })), navigationCues: geometry.navigationCues.map((cue) => ({ ...cue, pointId: ids.get(cue.pointId) ?? cue.pointId })) };
}

export function reorderRoute(route: Route, index: number, target: number): Route {
  const points = [...route.points];
  const coordinates = [...route.coordinates];
  const point = points.splice(index, 1)[0];
  const position = coordinates.splice(index, 1)[0];
  if (point === undefined || position === undefined || target < 0 || target > points.length) return route;
  points.splice(target, 0, point);
  coordinates.splice(target, 0, position);
  return { ...route, coordinates, points };
}
