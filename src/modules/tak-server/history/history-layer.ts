import Feature from "ol/Feature";
import Circle from "ol/geom/Circle";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import { createEmpty, extend, isEmpty } from "ol/extent";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat, getPointResolution } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import { lastIndexAtOrBefore, type TimelinePoint, type TimelineTrack } from "./track-timeline";

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

/** One continuous segment and the part of it the last frame drew, so unchanged parts are skipped. */
interface DrawnSegment {
  points: TimelinePoint[];
  coordinates: number[][];
  feature: Feature;
  drawn: string;
}

interface ProjectedTrack {
  track: TimelineTrack;
  color: string;
  segments: DrawnSegment[];
  marker: Feature;
  markerKey: string;
}

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(alpha)})`;
}

function lineStyle(color: string): Style {
  return new Style({ stroke: new Stroke({ color, width: 3 }) });
}

function dotStyle(color: string): Style {
  return new Style({ image: new CircleStyle({ radius: 3, fill: new Fill({ color }), declutterMode: "none" }) });
}

/** Approximate positions are areas, not points: the circle is the sender's stated accuracy. */
function areaStyle(color: string): Style {
  return new Style({ fill: new Fill({ color: rgba(color, 0.12) }), stroke: new Stroke({ color: rgba(color, 0.6), width: 1, lineDash: [4, 4] }) });
}

function markerStyle(color: string, label: string, stale: boolean): Style {
  return new Style({
    // Markers are never hidden by decluttering; only overlapping labels are.
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color: stale ? "#ffffff" : color }),
      stroke: new Stroke({ color: stale ? color : "#ffffff", width: stale ? 3 : 2 }),
      declutterMode: "none",
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

/** First index whose time is at or after `time` (points are ordered by time). */
function firstIndexAtOrAfter(points: readonly TimelinePoint[], time: number): number {
  return lastIndexAtOrBefore(points, time - 1) + 1;
}

/** The newest recorded position at or before `time` over all segments, with its map coordinate. */
function lastKnown(entry: ProjectedTrack, time: number): { point: TimelinePoint; coordinate: number[] } | null {
  for (let index = entry.segments.length - 1; index >= 0; index -= 1) {
    const segment = entry.segments[index] as DrawnSegment;
    const found = lastIndexAtOrBefore(segment.points, time);
    if (found >= 0) return { point: segment.points[found] as TimelinePoint, coordinate: segment.coordinates[found] as number[] };
  }
  return null;
}

/**
 * Recorded tracks on the shared event map: lines only inside Core's continuous segments, lone
 * positions as dots, approximate positions as accuracy circles, and one marker per track for the
 * last known position at the replay time. A coverage grid can be drawn underneath.
 *
 * Replay calls `render` on every animation frame, so the features are created once per change of
 * the shown tracks and a frame only updates the geometries and styles that actually changed.
 * Styles are cached, because a new text style forces OpenLayers to render the label again.
 */
export function createHistoryLayers(): {
  layers: VectorLayer[];
  setTracks(tracks: ReadonlyArray<{ track: TimelineTrack; color: string }>): void;
  render(frame: HistoryFrame): void;
  setCoverage(cells: readonly CoverageCell[], color: string): void;
  positionOf(uid: string): number[] | null;
  extent(): number[] | null;
} {
  // Every feature changes during replay; a spatial index would be rebuilt on each frame for nothing.
  const trackSource = new VectorSource({ useSpatialIndex: false });
  const coverageSource = new VectorSource();
  const layers = [
    new VectorLayer({ source: coverageSource, zIndex: 880 }),
    new VectorLayer({ source: trackSource, zIndex: 900, declutter: true }),
  ];
  let projected: ProjectedTrack[] = [];
  const markers = new Map<string, number[]>();
  const styles = new Map<string, Style>();
  let lastFrame: HistoryFrame | null = null;

  function cachedStyle(key: string, create: () => Style): Style {
    let style = styles.get(key);
    if (style === undefined) {
      style = create();
      styles.set(key, style);
    }
    return style;
  }

  function drawSegment(entry: ProjectedTrack, segment: DrawnSegment, frame: HistoryFrame): void {
    const end = lastIndexAtOrBefore(segment.points, frame.cursor);
    const start = frame.trailMs === null ? 0 : firstIndexAtOrAfter(segment.points, frame.cursor - frame.trailMs);
    const drawn = end < 0 || start > end ? "" : `${String(start)}-${String(end)}`;
    if (drawn === segment.drawn) return;
    segment.drawn = drawn;
    if (drawn === "") {
      segment.feature.setGeometry(undefined);
      return;
    }
    const first = segment.points[start] as TimelinePoint;
    const coordinate = segment.coordinates[start] as number[];
    if (first.approximate && first.ce !== null) {
      const radius = first.ce / getPointResolution("EPSG:3857", 1, coordinate, "m");
      segment.feature.setGeometry(new Circle(coordinate, radius));
      segment.feature.setStyle(cachedStyle(`area|${entry.color}`, () => areaStyle(entry.color)));
    } else if (end === start) {
      segment.feature.setGeometry(new Point(coordinate));
      segment.feature.setStyle(cachedStyle(`dot|${entry.color}`, () => dotStyle(entry.color)));
    } else {
      segment.feature.setGeometry(new LineString(segment.coordinates.slice(start, end + 1)));
      segment.feature.setStyle(cachedStyle(`line|${entry.color}`, () => lineStyle(entry.color)));
    }
  }

  function drawMarker(entry: ProjectedTrack, frame: HistoryFrame): void {
    const known = lastKnown(entry, frame.cursor);
    if (known === null || (frame.trailMs !== null && frame.cursor - known.point.time > frame.trailMs)) {
      markers.delete(entry.track.uid);
      if (entry.markerKey !== "") entry.marker.setGeometry(undefined);
      entry.markerKey = "";
      return;
    }
    markers.set(entry.track.uid, known.coordinate);
    const age = frame.cursor - known.point.time;
    const label = frame.label(entry.track, age);
    const stale = age > frame.staleAfterMs;
    const key = `${String(known.point.time)}|${label}|${String(stale)}`;
    if (key === entry.markerKey) return;
    entry.markerKey = key;
    entry.marker.setGeometry(new Point(known.coordinate));
    entry.marker.setStyle(cachedStyle(`marker|${entry.color}|${label}|${String(stale)}`, () => markerStyle(entry.color, label, stale)));
  }

  function render(frame: HistoryFrame): void {
    lastFrame = frame;
    for (const entry of projected) {
      for (const segment of entry.segments) drawSegment(entry, segment, frame);
      drawMarker(entry, frame);
    }
  }

  return {
    layers,
    setTracks(tracks) {
      styles.clear();
      markers.clear();
      projected = tracks.map(({ track, color }) => ({
        track,
        color,
        segments: track.segments.map((points) => ({ points, coordinates: points.map(({ lon, lat }) => fromLonLat([lon, lat])), feature: new Feature(), drawn: "" })),
        marker: new Feature(),
        markerKey: "",
      }));
      trackSource.clear();
      trackSource.addFeatures(projected.flatMap((entry) => [...entry.segments.map(({ feature }) => feature), entry.marker]));
      // New features start empty; draw them at the current replay time right away instead of
      // waiting for the next frame, which does not come while replay is paused.
      if (lastFrame !== null) render(lastFrame);
    },
    render,
    setCoverage(cells, color) {
      coverageSource.clear();
      coverageSource.addFeatures(
        cells.map((cell) => {
          const [minX = 0, minY = 0, maxX = 0, maxY = 0] = cell.extent;
          const polygon = new Polygon([[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]]);
          const created = new Feature({ geometry: polygon });
          created.setStyle(new Style({ fill: new Fill({ color: rgba(color, 0.1 + 0.5 * cell.weight) }) }));
          return created;
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
