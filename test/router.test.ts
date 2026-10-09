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
    ["/admin/settings/api-clients", "api-clients"],
    ["/admin/user-groups/00000000-0000-0000-0000-000000000000", "user-group-detail"],
    ["/admin/settings/general", "general-settings"],
  ])("resolves %s to %s", (path, name) => {
    expect(router.resolve(path).name).toBe(name);
  });

  it.each(["/admin/settings/email", "/admin/settings/registration", "/admin/settings/base-map", "/admin/email"])(
    "keeps the bookmark %s working",
    (path) => {
      expect(router.resolve(path).matched.at(-1)?.redirect).toEqual({ name: "general-settings" });
    },
  );

  it("resolves the offline HQ without a session or Core", () => {
    expect(router.resolve("/offline").name).toBe("offline-home");
    expect(router.resolve("/offline/00000000-0000-0000-0000-000000000000").name).toBe("offline-live");
    expect(router.resolve("/offline").meta.offline).toBe(true);
    expect(router.resolve("/").meta.offline).toBeUndefined();
  });

  it("treats only setup, sign-in and claim as public", () => {
    expect(router.resolve("/").meta.public).toBeUndefined();
    expect(router.resolve("/claim").meta.public).toBe(true);
  });
});
