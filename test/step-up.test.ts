import { afterEach, describe, expect, it, vi } from "vitest";
import { api, unwrap } from "@/shared/api/client";
import { setStepUpHandler } from "@/shared/api/step-up";
import { isApiProblem } from "@/shared/errors/api-problem";

const serviceAccountId = "6f1c1f43-6a5f-4c63-9a52-4c1c0f1d9a10";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

const recentSignInRequired = () =>
  jsonResponse(403, { status: 403, code: "RECENT_AUTHENTICATION_REQUIRED", detail: "Sign in again before performing this sensitive action." });

function createKey() {
  return unwrap(
    api.POST("/service-accounts/{serviceAccountId}/api-keys", {
      params: { path: { serviceAccountId } },
      body: { name: "primary key" },
    }),
  );
}

describe("step-up for sensitive requests", () => {
  afterEach(() => {
    setStepUpHandler(null);
    vi.unstubAllGlobals();
  });

  it("asks the user to sign in again and repeats the request with its body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(recentSignInRequired())
      .mockResolvedValueOnce(jsonResponse(201, { key: "omtk_sa_x" }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn().mockResolvedValue(true);
    setStepUpHandler(handler);

    await expect(createKey()).resolves.toEqual({ key: "omtk_sa_x" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect((fetchMock.mock.calls[1]?.[0] as Request).text()).resolves.toBe('{"name":"primary key"}');
  });

  it("returns the original problem when the user cancels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(recentSignInRequired()));
    setStepUpHandler(() => Promise.resolve(false));

    const failure: unknown = await createKey().catch((caught: unknown) => caught);
    expect(isApiProblem(failure, "RECENT_AUTHENTICATION_REQUIRED")).toBe(true);
  });

  it("leaves other forbidden responses alone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(403, { status: 403, code: "FORBIDDEN" })));
    const handler = vi.fn().mockResolvedValue(true);
    setStepUpHandler(handler);

    const failure: unknown = await createKey().catch((caught: unknown) => caught);
    expect(isApiProblem(failure, "FORBIDDEN")).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});
