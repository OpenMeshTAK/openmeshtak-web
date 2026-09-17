import { describe, expect, it } from "vitest";
import { sidcForCotType } from "@/modules/editor/map/cot-symbol";

describe("CoT type to MIL-STD-2525 SIDC", () => {
  it("maps atom types like TAK clients do", () => {
    expect(sidcForCotType("a-f-G-U-C-I")).toBe("SFGPUCI--------");
    expect(sidcForCotType("a-h-G")).toBe("SHGP-----------");
    expect(sidcForCotType("a-n-A-M-F")).toBe("SNAPMF---------");
  });

  it("has no military symbol for spot markers or unknown affiliations", () => {
    expect(sidcForCotType("b-m-p-s-m")).toBeNull();
    expect(sidcForCotType("a-x-G")).toBeNull();
    expect(sidcForCotType("a-f-Q")).toBeNull();
  });
});
