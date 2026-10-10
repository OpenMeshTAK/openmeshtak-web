import Feature from "ol/Feature";
import Circle from "ol/geom/Circle";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import Polygon, { fromCircle } from "ol/geom/Polygon";
import { createEmpty, extend, isEmpty } from "ol/extent";
import type BaseLayer from "ol/layer/Base";
import VectorLayer from "ol/layer/Vector";
import WebGLVectorLayer from "ol/layer/WebGLVector";
import { fromLonLat, getPointResolution } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import type { FlatStyle, Rule } from "ol/style/flat";
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

interface ProjectedTrack {
  track: TimelineTrack;
  color: string;
  segments: Array<{ points: TimelinePoint[]; coordinates: number[][] }>;
  marker: Feature;
  markerKey: string;
}

/** Path pieces by kind, so each gets its own WebGL style. */
const LINE = 1;
const DOT = 2;
const AREA = 3;
/** A line to or from an estimated position: drawn dashed, because nobody measured that way. */
const ESTIMATED_LINE = 4;

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(alpha)})`;
}

/**
 * Only pieces recorded inside the replay window are drawn: ended at or before the cursor and
 * started at or after the trail start. The GPU evaluates this per piece, so replay only changes two
 * variables instead of rebuilding geometry.
 */
function visibleAs(kind: number): Rule["filter"] {
  return ["all", ["==", ["get", "kind"], kind], ["<=", ["get", "end"], ["var", "cursor"]], [">=", ["get", "start"], ["var", "trailStart"]]];
}

const PATH_STYLE: Rule[] = [
  { filter: visibleAs(LINE), style: { "stroke-color": ["get", "color"], "stroke-width": 3 } satisfies FlatStyle },
  { filter: visibleAs(ESTIMATED_LINE), style: { "stroke-color": ["get", "color"], "stroke-width": 3, "stroke-line-dash": [8, 6] } satisfies FlatStyle },
  { filter: visibleAs(DOT), style: { "circle-radius": 3, "circle-fill-color": ["get", "color"] } satisfies FlatStyle },
  // Approximate positions are areas, not points: the circle is the sender's stated accuracy.
  { filter: visibleAs(AREA), style: { "fill-color": ["get", "fill"], "stroke-color": ["get", "color"], "stroke-width": 1 } satisfies FlatStyle },
];

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

/** The newest recorded position at or before `time` over all segments, with its map coordinate. */
function lastKnown(entry: ProjectedTrack, time: number): { point: TimelinePoint; coordinate: number[] } | null {
  for (let index = entry.segments.length - 1; index >= 0; index -= 1) {
    const segment = entry.segments[index] as ProjectedTrack["segments"][number];
    const found = lastIndexAtOrBefore(segment.points, time);
    if (found >= 0) return { point: segment.points[found] as TimelinePoint, coordinate: segment.coordinates[found] as number[] };
  }
  return null;
}

/**
 * Recorded tracks on the shared event map: lines only inside Core's continuous segments (dashed
 * where a position was only estimated), lone positions as dots, approximate positions as accuracy circles, and one marker per track for the
 * last known position at the replay time. A coverage grid can be drawn underneath.
 *
 * Hundreds of tracks hold tens of thousands of positions, which the canvas renderer would redraw
 * completely whenever one line grows. The paths therefore live in a WebGL layer as one piece per
 * pair of positions, tagged with their time; replay only moves the time window. Times are seconds
 * from the first position, because WebGL compares 32-bit floats and epoch milliseconds would lose
 * their precision. The markers and labels stay on canvas and are only touched when they change.
 */
export function createHistoryLayers(): {
  layers: BaseLayer[];
  setTracks(tracks: ReadonlyArray<{ track: TimelineTrack; color: string }>): void;
  render(frame: HistoryFrame): void;
  setCoverage(cells: readonly CoverageCell[], color: string): void;
  positionOf(uid: string): number[] | null;
  extent(): number[] | null;
} {
  const pathSource = new VectorSource();
  const markerSource = new VectorSource({ useSpatialIndex: false });
  const coverageSource = new VectorSource();
  const paths = new WebGLVectorLayer({
    source: pathSource,
    style: PATH_STYLE,
    variables: { cursor: -1, trailStart: -1 },
    disableHitDetection: true,
    zIndex: 890,
  });
  const layers: BaseLayer[] = [
    new VectorLayer({ source: coverageSource, zIndex: 880 }),
    paths,
    new VectorLayer({ source: markerSource, zIndex: 900, declutter: true }),
  ];
  let projected: ProjectedTrack[] = [];
  let origin = 0;
  const markers = new Map<string, number[]>();
  const styles = new Map<string, Style>();
  let lastFrame: HistoryFrame | null = null;

  function seconds(time: number): number {
    return (time - origin) / 1000;
  }

  function piece(geometry: LineString | Point | Polygon, kind: number, color: string, start: number, end: number): Feature {
    const feature = new Feature({ geometry, kind, color, fill: rgba(color, 0.12), start: seconds(start), end: seconds(end) });
    return feature;
  }

  function pathPieces(entry: ProjectedTrack): Feature[] {
    const pieces: Feature[] = [];
    for (const { points, coordinates } of entry.segments) {
      const first = points[0];
      const coordinate = coordinates[0];
      if (first === undefined || coordinate === undefined) continue;
      if (first.approximate && first.ce !== null) {
        const radius = first.ce / getPointResolution("EPSG:3857", 1, coordinate, "m");
        pieces.push(piece(fromCircle(new Circle(coordinate, radius), 32), AREA, entry.color, first.time, first.time));
      } else if (points.length === 1) {
        pieces.push(piece(new Point(coordinate), DOT, entry.color, first.time, first.time));
      } else {
        for (let index = 1; index < points.length; index += 1) {
          const from = points[index - 1] as TimelinePoint;
          const to = points[index] as TimelinePoint;
          const kind = from.estimated || to.estimated ? ESTIMATED_LINE : LINE;
          pieces.push(piece(new LineString([coordinates[index - 1] as number[], coordinates[index] as number[]]), kind, entry.color, from.time, to.time));
        }
      }
    }
    return pieces;
  }

  function cachedStyle(key: string, create: () => Style): Style {
    let style = styles.get(key);
    if (style === undefined) {
      style = create();
      styles.set(key, style);
    }
    return style;
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
    entry.marker.setStyle(cachedStyle(`${entry.color}|${label}|${String(stale)}`, () => markerStyle(entry.color, label, stale)));
  }

  function render(frame: HistoryFrame): void {
    lastFrame = frame;
    const cursor = seconds(frame.cursor);
    // A tiny tolerance keeps the piece that ends exactly at the cursor visible despite float rounding.
    paths.updateStyleVariables({ cursor: cursor + 0.001, trailStart: frame.trailMs === null ? -1e9 : cursor - frame.trailMs / 1000 - 0.001 });
    for (const entry of projected) drawMarker(entry, frame);
  }

  return {
    layers,
    setTracks(tracks) {
      styles.clear();
      markers.clear();
      origin = Math.min(...tracks.map(({ track }) => track.firstTime), Number.POSITIVE_INFINITY);
      if (!Number.isFinite(origin)) origin = 0;
      projected = tracks.map(({ track, color }) => ({
        track,
        color,
        segments: track.segments.map((points) => ({ points, coordinates: points.map(({ lon, lat }) => fromLonLat([lon, lat])) })),
        marker: new Feature(),
        markerKey: "",
      }));
      pathSource.clear();
      pathSource.addFeatures(projected.flatMap(pathPieces));
      markerSource.clear();
      markerSource.addFeatures(projected.map(({ marker }) => marker));
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
