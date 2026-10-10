import { describe, expect, it } from "vitest";
import type Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";
import type { StyleFunction } from "ol/style/Style";
import { createHistoryLayers } from "@/modules/tak-server/history/history-layer";
import type { TimelineTrack } from "@/modules/tak-server/history/track-timeline";

const START = Date.parse("2026-10-01T10:00:00.000Z");

function track(): TimelineTrack {
  const points = [0, 10, 20].map((seconds, index) => ({ time: START + seconds * 1000, lat: 52, lon: 11 + index * 0.001, ce: 5, delayed: false, approximate: false, estimated: index === 2 }));
  return {
    uid: "A", label: "Alpha", type: "a-f-G", selfReported: true, senderName: "Alpha", groupId: null, groupName: null,
    pointCount: 3, duplicatesDropped: 0, delayedCount: 0, approximateCount: 0, firstTime: points[0]!.time, lastTime: points[2]!.time, segments: [points],
  };
}

describe("history path layer without WebGL", () => {
  // jsdom offers no WebGL, like an old tablet or a browser with hardware acceleration off.
  const history = createHistoryLayers();
  history.setTracks([{ track: track(), color: "#1e88e5" }]);
  const paths = history.layers.find((layer) => layer instanceof VectorLayer && layer.getZIndex() === 890) as VectorLayer<VectorSource<Feature>>;
  const style = paths.getStyleFunction() as StyleFunction;
  const visible = () => paths.getSource()!.getFeatures().filter((feature) => style(feature, 1) !== undefined).map((feature) => feature.get("kind") as number);

  it("falls back to a canvas layer that filters pieces by the replay window", () => {
    history.render({ cursor: START + 15_000, trailMs: null, staleAfterMs: 300_000, label: (t) => t.label });
    expect(visible()).toEqual([1]);
    history.render({ cursor: START + 20_000, trailMs: null, staleAfterMs: 300_000, label: (t) => t.label });
    expect(visible()).toEqual([1, 4]);
    history.render({ cursor: START + 20_000, trailMs: 12_000, staleAfterMs: 300_000, label: (t) => t.label });
    expect(visible()).toEqual([4]);
  });
});
