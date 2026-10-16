import type { TakTrackDto, TakTrackPointDto } from "../tak-server.api";

/**
 * Client-side read model of recorded tracks for the timeline and replay. Core already split the
 * tracks into continuous segments (gaps, implausible jumps and approximate positions); this
 * module only looks things up by time and never joins segments.
 */
export interface TimelinePoint {
  time: number;
  lat: number;
  lon: number;
  ce: number | null;
  delayed: boolean;
  approximate: boolean;
  /** The sender marked the position as estimated, e.g. a PC without GPS. */
  estimated: boolean;
}

/** Where a track's mesh positions came from: the nodes and the HQs that heard them. */
export interface TrackMeshSummary {
  pointCount: number;
  nodeIds: string[];
  hqNames: string[];
}

export interface TimelineTrack {
  uid: string;
  label: string;
  type: string;
  selfReported: boolean;
  /** Null for a Meshtastic node no member is bound to. */
  senderName: string | null;
  groupId: string | null;
  groupName: string | null;
  pointCount: number;
  duplicatesDropped: number;
  delayedCount: number;
  approximateCount: number;
  firstTime: number;
  lastTime: number;
  segments: TimelinePoint[][];
  /** Null when every position came from TAK apps. */
  mesh: TrackMeshSummary | null;
}

function meshSummary(points: readonly TakTrackPointDto[]): TrackMeshSummary | null {
  const meshPoints = points.flatMap((point) => (point.mesh === undefined ? [] : [point.mesh]));
  if (meshPoints.length === 0) return null;
  return {
    pointCount: meshPoints.length,
    nodeIds: [...new Set(meshPoints.map(({ nodeId }) => nodeId))],
    hqNames: [...new Set(meshPoints.map(({ hqId, hqName }) => hqName ?? `HQ ${hqId.slice(0, 8)}`))],
  };
}

export function toTimelineTracks(tracks: readonly TakTrackDto[]): TimelineTrack[] {
  return tracks.map((track) => {
    const segments = track.segments.map((segment) =>
      segment.map((point) => ({ ...point, time: Date.parse(point.time) })),
    );
    const points = segments.flat();
    return {
      uid: track.uid,
      label: track.callsign ?? track.uid,
      type: track.type,
      selfReported: track.selfReported,
      senderName: track.sender?.displayName ?? null,
      groupId: track.sender?.eventGroupId ?? null,
      groupName: track.sender?.eventGroupName ?? null,
      pointCount: track.pointCount,
      duplicatesDropped: track.duplicatesDropped,
      delayedCount: points.filter(({ delayed }) => delayed).length,
      approximateCount: points.filter(({ approximate }) => approximate).length,
      firstTime: points[0]?.time ?? 0,
      lastTime: points.at(-1)?.time ?? 0,
      segments,
      mesh: meshSummary(track.segments.flat()),
    };
  });
}

/** Index of the last point at or before `time`, or -1. Points are ordered by time. */
export function lastIndexAtOrBefore(points: readonly TimelinePoint[], time: number): number {
  let low = 0;
  let high = points.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((points[middle] as TimelinePoint).time <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** The newest recorded position at or before `time`: what was last known about the track then. */
export function lastKnownAt(track: TimelineTrack, time: number): TimelinePoint | null {
  for (let index = track.segments.length - 1; index >= 0; index -= 1) {
    const segment = track.segments[index] as TimelinePoint[];
    const found = lastIndexAtOrBefore(segment, time);
    if (found >= 0) {
      return segment[found] as TimelinePoint;
    }
  }
  return null;
}

/** "12 s", "4 min", "2 h 5 min" — how old the last known position is. */
export function formatAge(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
  return `${String(Math.floor(hours / 24))} d`;
}

/** Earliest and latest recorded time over all tracks, or null without positions. */
export function timeSpan(tracks: readonly TimelineTrack[]): { start: number; end: number } | null {
  if (tracks.length === 0) return null;
  return {
    start: Math.min(...tracks.map(({ firstTime }) => firstTime)),
    end: Math.max(...tracks.map(({ lastTime }) => lastTime)),
  };
}
