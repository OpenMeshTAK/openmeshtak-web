import { describe, expect, it } from "vitest";
import { sanitizeLogMetadata } from "@/shared/logging/sanitize";

describe("web log sanitization", () => {
  it("redacts secret-looking fields and OpenMeshTak tokens in text", () => {
    const key = `omtk_ak_${"a".repeat(24)}_${"b".repeat(43)}`;

    expect(
      sanitizeLogMetadata({
        password: "hunter2",
        nested: { sessionToken: "abc", note: `copied ${key}` },
        claimUrl: "https://example.test/claim#omtk_claim_x",
        status: 401,
      }),
    ).toEqual({
      password: "[REDACTED]",
      nested: { sessionToken: "[REDACTED]", note: "copied [REDACTED]" },
      claimUrl: "[REDACTED]",
      status: 401,
    });
  });

  it("survives circular structures", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(sanitizeLogMetadata(value)).toEqual({ self: "[CIRCULAR]" });
  });
});
