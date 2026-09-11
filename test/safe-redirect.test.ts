import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/shared/security/safe-redirect";

describe("post-login redirects", () => {
  it("keeps same-application paths", () => {
    expect(safeRedirectPath("/admin/events?status=draft")).toBe("/admin/events?status=draft");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", undefined, ["/"]])(
    "rejects %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/");
    },
  );
});
