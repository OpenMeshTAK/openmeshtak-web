import { describe, expect, it } from "vitest";
import type ImageTile from "ol/ImageTile";
import { get as getProjection } from "ol/proj";
import { createBaseMapSource } from "@/modules/editor/map/package-map";

describe("base map", () => {
  it("sends the installation origin to tile providers that require a browser referrer", () => {
    const source = createBaseMapSource({
      tileUrlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    });
    const projection = getProjection("EPSG:3857");

    expect(projection).not.toBeNull();
    const tile = source.getTile(0, 0, 0, 1, projection!) as ImageTile;
    expect(tile.getReferrerPolicy()).toBe("strict-origin-when-cross-origin");
  });
});
