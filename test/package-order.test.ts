import { describe, expect, it } from "vitest";
import { reorderedBottomFirst, topFirst } from "@/modules/data-packages/package-order";

const packages = [
  { id: "base", sortOrder: 0, createdAt: "2026-10-05T10:00:00Z" },
  { id: "roads", sortOrder: 1, createdAt: "2026-10-05T11:00:00Z" },
  { id: "markers", sortOrder: 2, createdAt: "2026-10-05T12:00:00Z" },
];

describe("data package order", () => {
  it("lists the package drawn on top first", () => {
    expect(topFirst(packages).map(({ id }) => id)).toEqual(["markers", "roads", "base"]);
  });

  it("moves a dragged package to the drop target and answers bottom first", () => {
    expect(reorderedBottomFirst(["markers", "roads", "base"], "base", "markers")).toEqual(["roads", "markers", "base"]);
    expect(reorderedBottomFirst(["markers", "roads", "base"], "markers", "base")).toEqual(["markers", "base", "roads"]);
    expect(reorderedBottomFirst(["markers", "roads"], "roads", "roads")).toBeNull();
  });
});
