import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";

/** jsdom cannot run Vuetify's dialog overlay; the stub renders the content while open. */
const DialogStub = { props: ["modelValue"], template: `<div v-if="modelValue" class="dialog"><slot /></div>` };

function grantResponse(expiresAt: Date): Response {
  return new Response(JSON.stringify({ url: "https://omtk.example.org/api/v1/downloads/secret-token", expiresAt: expiresAt.toISOString() }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

function mountButton() {
  return mount(DownloadQrButton, {
    props: { request: { kind: "tak-connection-package" }, fileLabel: "the connection package" },
    global: { plugins: [createVuetify()], stubs: { VDialog: DialogStub } },
  });
}

describe("download QR button", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks Core for a short-lived link and shows it as a QR code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(grantResponse(new Date(Date.now() + 5 * 60_000)));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountButton();

    await wrapper.find("button").trigger("click");
    await flushPromises();

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe("/api/v1/me/download-grants");
    expect(await request.clone().json()).toEqual({ kind: "tak-connection-package" });
    expect(wrapper.find(".dialog").text()).toContain("Scan this code with the phone that should get the connection package");
    expect(wrapper.find("svg[aria-label='Download link for the connection package']").exists()).toBe(true);
  });

  it("offers a new code once the link expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(grantResponse(new Date(Date.now() - 1000))));
    const wrapper = mountButton();

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(wrapper.find(".dialog").text()).toContain("This code expired");
    expect(wrapper.find("svg[aria-label]").exists()).toBe(false);
  });
});
