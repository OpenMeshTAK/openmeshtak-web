import { describe, expect, it } from "vitest";
import { router } from "@/app/router";

describe("route table", () => {
  it.each([
    ["/", "home"],
    ["/setup", "setup"],
    ["/sign-in", "sign-in"],
    ["/claim", "claim"],
    ["/admin/events", "events"],
    ["/admin/user-groups", "user-groups"],
    ["/admin/service-accounts", "service-accounts"],
  ])("resolves %s to %s", (path, name) => {
    expect(router.resolve(path).name).toBe(name);
  });

  it("treats only setup, sign-in and claim as public", () => {
    expect(router.resolve("/").meta.public).toBeUndefined();
    expect(router.resolve("/claim").meta.public).toBe(true);
  });
});
