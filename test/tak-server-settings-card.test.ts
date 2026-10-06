import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import TakServerSettingsCard from "@/modules/tak-server/components/TakServerSettingsCard.vue";
import type { TakServerSettingsDto } from "@/modules/tak-server/tak-server.api";

const settings: TakServerSettingsDto = {
  enabled: true,
  hostName: "tak.example.org",
  enrollmentPort: 8446,
  martiPort: 8443,
  streamingPort: 8089,
  clientCertificateDays: 365,
  serverCertificate: null,
  endpointChangedAt: null,
  validClientCertificates: 2,
  clientCertificatesToReEnroll: 0,
  version: 3,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

/** jsdom cannot run Vuetify's dialog overlay; the stub keeps the slot and the confirm event. */
const ConfirmDialogStub = {
  props: ["modelValue"],
  emits: ["confirm"],
  template: `<div v-if="modelValue" class="confirm-dialog"><slot /><button class="confirm" @click="$emit('confirm')">Confirm</button></div>`,
};

const confirmationRequired = {
  status: 422,
  code: "VALIDATION_FAILED",
  detail: "The request is invalid.",
  errors: [{ field: "endpointChange", code: "ENDPOINT_CHANGE_CONFIRMATION_REQUIRED", message: "Confirm the change." }],
};

describe("TAK server settings card", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for a decision when Core requires one and resends the save with it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(422, confirmationRequired))
      .mockResolvedValueOnce(jsonResponse(200, { ...settings, hostName: "tak2.example.org", version: 4 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(TakServerSettingsCard, {
      props: { settings },
      global: { plugins: [createVuetify()], stubs: { ConfirmDialog: ConfirmDialogStub } },
    });

    await wrapper.find("input").setValue("tak2.example.org");
    await wrapper.findAll("button").find((button) => button.text() === "Save")?.trigger("click");
    await flushPromises();

    expect(wrapper.find(".confirm-dialog").text()).toContain("2 enrolled apps keep the old address");
    await wrapper.find("button.confirm").trigger("click");
    await flushPromises();

    const resent = (await (fetchMock.mock.calls[1]?.[0] as Request).clone().json()) as { endpointChange?: unknown };
    expect(resent.endpointChange).toEqual({ notifyAffectedUsers: true });
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });
});
