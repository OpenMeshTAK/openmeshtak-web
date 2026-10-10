import { describe, expect, it } from "vitest";
import { toMapGeometry } from "@/modules/editor/map/geometry-codec";
import { coverageCells, timeInArea } from "@/modules/tak-server/history/track-analysis";
import { formatAge, lastKnownAt, toTimelineTracks } from "@/modules/tak-server/history/track-timeline";
import type { TakTrackDto, TakTrackPointDto } from "@/modules/tak-server/tak-server.api";

const START = Date.parse("2026-10-01T10:00:00.000Z");

function point(seconds: number, lon: number, approximate = false): TakTrackPointDto {
  return { time: new Date(START + seconds * 1000).toISOString(), lat: 50, lon, ce: approximate ? 1500 : 5, delayed: false, approximate, estimated: false };
}

function track(segments: TakTrackPointDto[][]): TakTrackDto {
  return {
    uid: "ALPHA",
    type: "a-f-G-U-C",
    callsign: "Alpha",
    selfReported: true,
    sender: { userId: "00000000-0000-4000-8000-000000000001", displayName: "Alpha", eventGroupId: null, eventGroupName: null },
    pointCount: segments.flat().length,
    duplicatesDropped: 0,
    segments,
  };
}

describe("recorded track timeline", () => {
  const [alpha] = toTimelineTracks([track([[point(0, 8.0), point(60, 8.001)], [point(600, 8.002, true)], [point(900, 8.003), point(960, 8.004)]])]);

  it("finds the last known position at a replay time, across gaps", () => {
    expect(alpha).toBeDefined();
    if (alpha === undefined) return;
    expect(lastKnownAt(alpha, START - 1)).toBeNull();
    expect(lastKnownAt(alpha, START + 300_000)?.lon).toBe(8.001);
    expect(lastKnownAt(alpha, START + 700_000)?.approximate).toBe(true);
    expect(alpha.approximateCount).toBe(1);
  });

  it("formats position ages", () => {
    expect(formatAge(12_000)).toBe("12 s");
    expect(formatAge(240_000)).toBe("4 min");
    expect(formatAge(7_500_000)).toBe("2 h 5 min");
  });

  it("counts time in an area only inside continuous segments and without approximate positions", () => {
    if (alpha === undefined) return;
    const area = toMapGeometry({ type: "Rectangle", coordinates: [[7.9, 49.9], [8.1, 49.9], [8.1, 50.1], [7.9, 50.1]] });
    const [visit] = timeInArea([alpha], area);
    // 0→60 s and 900→960 s count; the gap from 60 s to 900 s and the approximate position do not.
    expect(visit?.insideMs).toBe(120_000);
    expect(visit?.entries).toBe(2);
  });

  it("weights activity cells by recorded time relative to the busiest cell", () => {
    if (alpha === undefined) return;
    const cells = coverageCells([alpha], 100_000);
    expect(cells.length).toBe(1);
    expect(cells[0]?.weight).toBe(1);
  });
});
