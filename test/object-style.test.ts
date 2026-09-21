import Feature from "ol/Feature";
import Polygon from "ol/geom/Polygon";
import { describe, expect, it } from "vitest";
import { objectPriority } from "@/modules/editor/map/object-style";

function areaFeature(size: number, layerRank: number): Feature<Polygon> {
  const feature = new Feature(
    new Polygon([
      [
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
        [0, 0],
      ],
    ]),
  );
  feature.set("kind", "polygon");
  feature.set("layerRank", layerRank);
  return feature;
}

describe("map object priority", () => {
  it("places every object from a higher layer above lower-layer objects", () => {
    const building = areaFeature(10, 1);
    const gameArea = areaFeature(10_000, 0);

    expect(objectPriority(building)).toBeGreaterThan(objectPriority(gameArea));
  });

  it("places smaller areas above larger areas within one layer", () => {
    const building = areaFeature(10, 0);
    const gameArea = areaFeature(10_000, 0);

    expect(objectPriority(building)).toBeGreaterThan(objectPriority(gameArea));
  });
});
