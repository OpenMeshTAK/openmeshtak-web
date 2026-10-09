import Feature from "ol/Feature";
import Circle from "ol/geom/Circle";
import type Geometry from "ol/geom/Geometry";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import { createEmpty, extend, isEmpty } from "ol/extent";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat, getPointResolution } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import { lastIndexAtOrBefore, lastKnownAt, type TimelinePoint, type TimelineTrack } from "./track-timeline";

/** What the replay shows at one moment. */
export interface HistoryFrame {
  /** Replay time; nothing recorded after it is drawn. */
  cursor: number;
  /** Only this much of each track before the cursor, or the whole past when null. */
  trailMs: number | null;
  /** A last known position older than this is drawn hollow: the device was not heard from since. */
  staleAfterMs: number;
  label(track: TimelineTrack, ageMs: number): string;
}

export interface CoverageCell {
  /** Web Mercator extent of the cell. */
  extent: number[];
  /** 0..1, relative to the busiest cell. */
  weight: number;
}

interface ProjectedTrack {
  track: TimelineTrack;
  color: string;
  segments: Array<{ points: TimelinePoint[]; coordinates: number[][] }>;
}

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(alpha)})`;
}

function lineStyle(color: string): Style {
  return new Style({ stroke: new Stroke({ color, width: 3 }) });
}

function dotStyle(color: string): Style {
  return new Style({ image: new CircleStyle({ radius: 3, fill: new Fill({ color }) }) });
}

/** Approximate positions are areas, not points: the circle is the sender's stated accuracy. */
function areaStyle(color: string): Style {
  return new Style({ fill: new Fill({ color: rgba(color, 0.12) }), stroke: new Stroke({ color: rgba(color, 0.6), width: 1, lineDash: [4, 4] }) });
}

function markerStyle(color: string, label: string, stale: boolean): Style {
  return new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color: stale ? "#ffffff" : color }),
      stroke: new Stroke({ color: stale ? color : "#ffffff", width: stale ? 3 : 2 }),
    }),
    text: new Text({
      text: label,
      offsetY: -16,
      font: "600 12px Roboto, sans-serif",
      fill: new Fill({ color: "#ffffff" }),
      stroke: new Stroke({ color: "rgba(0, 0, 0, 0.75)", width: 3 }),
    }),
  });
}

function feature(geometry: Geometry, style: Style): Feature {
  const created = new Feature({ geometry });
  created.setStyle(style);
  return created;
}

/** First index whose time is at or after `time` (points are ordered by time). */
function firstIndexAtOrAfter(points: readonly TimelinePoint[], time: number): number {
  return lastIndexAtOrBefore(points, time - 1) + 1;
}

/**
 * Recorded tracks on the shared event map: lines only inside Core's continuous segments, lone
 * positions as dots, approximate positions as accuracy circles, and one marker per track for the
 * last known position at the replay time. A coverage grid can be drawn underneath.
 */
export function createHistoryLayers(): {
  layers: VectorLayer[];
  setTracks(tracks: ReadonlyArray<{ track: TimelineTrack; color: string }>): void;
  render(frame: HistoryFrame): void;
  setCoverage(cells: readonly CoverageCell[], color: string): void;
  positionOf(uid: string): number[] | null;
  extent(): number[] | null;
} {
  const trackSource = new VectorSource();
  const coverageSource = new VectorSource();
  const layers = [new VectorLayer({ source: coverageSource, zIndex: 880 }), new VectorLayer({ source: trackSource, zIndex: 900 })];
  let projected: ProjectedTrack[] = [];
  const markers = new Map<string, number[]>();

  function drawSegment(entry: ProjectedTrack, segment: ProjectedTrack["segments"][number], frame: HistoryFrame): Feature[] {
    const end = lastIndexAtOrBefore(segment.points, frame.cursor);
    const start = frame.trailMs === null ? 0 : firstIndexAtOrAfter(segment.points, frame.cursor - frame.trailMs);
    if (end < 0 || start > end) return [];
    const first = segment.points[start] as TimelinePoint;
    const coordinate = segment.coordinates[start] as number[];
    if (first.approximate && first.ce !== null) {
      const radius = first.ce / getPointResolution("EPSG:3857", 1, coordinate, "m");
      return [feature(new Circle(coordinate, radius), areaStyle(entry.color))];
    }
    if (end === start) return [feature(new Point(coordinate), dotStyle(entry.color))];
    return [feature(new LineString(segment.coordinates.slice(start, end + 1)), lineStyle(entry.color))];
  }

  return {
    layers,
    setTracks(tracks) {
      projected = tracks.map(({ track, color }) => ({
        track,
        color,
        segments: track.segments.map((points) => ({ points, coordinates: points.map(({ lon, lat }) => fromLonLat([lon, lat])) })),
      }));
    },
    render(frame) {
      trackSource.clear();
      markers.clear();
      const features: Feature[] = [];
      for (const entry of projected) {
        for (const segment of entry.segments) features.push(...drawSegment(entry, segment, frame));
        const known = lastKnownAt(entry.track, frame.cursor);
        if (known === null || (frame.trailMs !== null && frame.cursor - known.time > frame.trailMs)) continue;
        const coordinate = fromLonLat([known.lon, known.lat]);
        markers.set(entry.track.uid, coordinate);
        const age = frame.cursor - known.time;
        features.push(feature(new Point(coordinate), markerStyle(entry.color, frame.label(entry.track, age), age > frame.staleAfterMs)));
      }
      trackSource.addFeatures(features);
    },
    setCoverage(cells, color) {
      coverageSource.clear();
      coverageSource.addFeatures(
        cells.map((cell) => {
          const [minX = 0, minY = 0, maxX = 0, maxY = 0] = cell.extent;
          const polygon = new Polygon([[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]]);
          return feature(polygon, new Style({ fill: new Fill({ color: rgba(color, 0.1 + 0.5 * cell.weight) }) }));
        }),
      );
    },
    positionOf(uid) {
      const marker = markers.get(uid);
      if (marker !== undefined) return marker;
      const segment = projected.find(({ track }) => track.uid === uid)?.segments.at(-1);
      return segment?.coordinates.at(-1) ?? null;
    },
    extent() {
      const combined = createEmpty();
      for (const entry of projected) {
        for (const segment of entry.segments) for (const coordinate of segment.coordinates) extend(combined, [...coordinate, ...coordinate]);
      }
      return isEmpty(combined) ? null : combined;
    },
  };
}
