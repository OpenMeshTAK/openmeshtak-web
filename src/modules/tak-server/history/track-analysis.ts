import type Geometry from "ol/geom/Geometry";
import { fromLonLat } from "ol/proj";
import type { CoverageCell } from "./history-layer";
import type { TimelineTrack } from "./track-timeline";

/**
 * Post-event analysis over the loaded tracks. Both measures use only what was received: time is
 * counted between two consecutive positions of the same continuous segment, never across a gap,
 * and approximate positions are left out because their place is not known well enough.
 */

/**
 * Activity per grid cell: how much recorded time the shown tracks spent in each cell, relative to
 * the busiest cell. Cells are square in Web Mercator, which is close enough for an event area.
 */
export function coverageCells(tracks: readonly TimelineTrack[], cellMetres: number, until = Number.POSITIVE_INFINITY): CoverageCell[] {
  const weights = new Map<string, { x: number; y: number; ms: number }>();
  for (const track of tracks) {
    for (const segment of track.segments) {
      segment.forEach((point, index) => {
        if (point.approximate || point.time > until) return;
        const next = segment[index + 1];
        // A lone position still shows the place was reached; it counts as one second.
        const ms = next === undefined || next.time > until ? 1000 : next.time - point.time;
        const [x = 0, y = 0] = fromLonLat([point.lon, point.lat]);
        const cellX = Math.floor(x / cellMetres);
        const cellY = Math.floor(y / cellMetres);
        const key = `${String(cellX)}:${String(cellY)}`;
        const cell = weights.get(key) ?? { x: cellX, y: cellY, ms: 0 };
        cell.ms += ms;
        weights.set(key, cell);
      });
    }
  }
  const busiest = Math.max(1, ...[...weights.values()].map(({ ms }) => ms));
  return [...weights.values()].map(({ x, y, ms }) => ({
    extent: [x * cellMetres, y * cellMetres, (x + 1) * cellMetres, (y + 1) * cellMetres],
    // Square root so short visits stay visible next to a long stay at a base.
    weight: Math.sqrt(ms / busiest),
  }));
}

export interface AreaVisit {
  uid: string;
  label: string;
  /** Recorded time inside the area. */
  insideMs: number;
  /** How often the track came into the area. */
  entries: number;
  firstInside: number | null;
  lastInside: number | null;
}

/**
 * Time each track spent inside an area (a polygon, rectangle, circle or ellipse of the event's
 * map, in Web Mercator). An interval counts when both of its positions are inside.
 */
export function timeInArea(tracks: readonly TimelineTrack[], area: Geometry): AreaVisit[] {
  return tracks
    .map((track) => {
      let insideMs = 0;
      let entries = 0;
      let firstInside: number | null = null;
      let lastInside: number | null = null;
      for (const segment of track.segments) {
        let wasInside = false;
        segment.forEach((point, index) => {
          const inside = !point.approximate && area.intersectsCoordinate(fromLonLat([point.lon, point.lat]));
          if (inside) {
            if (!wasInside) entries += 1;
            firstInside ??= point.time;
            lastInside = point.time;
            const next = segment[index + 1];
            if (next !== undefined && !next.approximate && area.intersectsCoordinate(fromLonLat([next.lon, next.lat]))) {
              insideMs += next.time - point.time;
            }
          }
          wasInside = inside;
        });
      }
      return { uid: track.uid, label: track.label, insideMs, entries, firstInside, lastInside };
    })
    .filter(({ entries }) => entries > 0)
    .sort((a, b) => b.insideMs - a.insideMs || a.label.localeCompare(b.label));
}
