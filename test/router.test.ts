import { describe, expect, it } from "vitest";
import { router } from "@/app/router";

describe("route table", () => {
  it.each([
    ["/", "home"],
    ["/setup", "setup"],
    ["/sign-in", "sign-in"],
    ["/claim", "claim"],
    ["/admin/events", "events"],
    ["/admin/events/00000000-0000-0000-0000-000000000000/data-packages", "event-editor"],
    ["/admin/user-groups", "user-groups"],
    ["/admin/service-accounts", "service-accounts"],
    ["/admin/user-groups/00000000-0000-0000-0000-000000000000", "user-group-detail"],
    ["/admin/settings/email", "email-settings"],
  ])("resolves %s to %s", (path, name) => {
    expect(router.resolve(path).name).toBe(name);
  });

  it("treats only setup, sign-in and claim as public", () => {
    expect(router.resolve("/").meta.public).toBeUndefined();
    expect(router.resolve("/claim").meta.public).toBe(true);
  });
});
