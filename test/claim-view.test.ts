import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { createVuetify } from "vuetify";
import ClaimView from "@/modules/member-claims/ClaimView.vue";

const token = `omtk_claim_${"A".repeat(43)}`;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

async function mountClaim(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", `/claim#${token}`);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/claim", name: "claim", component: ClaimView },
      { path: "/", name: "home", component: { template: "<div />" } },
      { path: "/sign-in", name: "sign-in", component: { template: "<div />" } },
    ],
  });
  await router.push("/claim");
  const wrapper = mount(ClaimView, { global: { plugins: [createVuetify(), router] } });
  await flushPromises();
  return { wrapper, router };
}

function requestBody(call: unknown[]): Promise<string> {
  return (call[0] as Request).clone().text();
}

describe("claim page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes the token from the URL and sends it only in the request body", async () => {
    const fetchMock = vi.fn((request: Request) =>
      Promise.resolve(
        request.url.endsWith("/auth/claims/exchange")
          ? jsonResponse(200, { user: { id: "u", displayName: "Peter" }, eventId: "e" })
          : jsonResponse(200, { type: "user", id: "u", name: "Peter", permissions: [] }),
      ),
    );

    const { router } = await mountClaim(fetchMock);

    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("omtk_claim_");
    const exchange = fetchMock.mock.calls.find(([request]) => request.url.endsWith("/auth/claims/exchange"));
    expect(exchange).toBeDefined();
    expect((exchange?.[0] as Request).url).not.toContain("omtk_claim_");
    expect(await requestBody(exchange ?? [])).toBe(JSON.stringify({ token }));
    expect(router.currentRoute.value.name).toBe("home");
  });

  it("explains unusable links without retrying", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(401, { status: 401, code: "INVALID_CLAIM" })));

    const { wrapper } = await mountClaim(fetchMock);

    expect(wrapper.text()).toContain("This link cannot be used");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks accounts with their own sign-in to sign in instead", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(403, { status: 403, code: "SIGN_IN_REQUIRED", detail: "Sign in." })),
    );

    const { wrapper } = await mountClaim(fetchMock);

    expect(wrapper.text()).toContain("Please sign in");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
