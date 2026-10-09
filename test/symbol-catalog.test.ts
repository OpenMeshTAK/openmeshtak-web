import ms from "milsymbol";
import { describe, expect, it } from "vitest";
import { sidcForCotType } from "@/modules/editor/map/cot-symbol";
import { AFFILIATIONS, cotTypeOf, describeCotType, SYMBOLS } from "@/modules/editor/symbols/symbol-catalog";

describe("marker symbol catalogue", () => {
  it("only lists symbols the symbol library can draw, for every affiliation", () => {
    const invalid = AFFILIATIONS.flatMap((affiliation) =>
      SYMBOLS.map((symbol) => cotTypeOf(affiliation.code, symbol)).filter((cotType) => {
        const sidc = sidcForCotType(cotType);
        return sidc === null || new ms.Symbol(sidc).isValid() !== true;
      }),
    );
    expect(invalid).toEqual([]);
  });

  it("names catalogued types and route points", () => {
    expect(describeCotType("a-s-G-U-C-I")).toBe("Suspect · Infantry");
    expect(describeCotType("b-m-p-w")).toBe("Waypoint");
    expect(describeCotType("b-m-p-c")).toBe("Checkpoint");
    expect(describeCotType("a-f-X")).toBeNull();
  });
});
