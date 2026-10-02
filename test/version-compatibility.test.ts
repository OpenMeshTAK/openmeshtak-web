import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { createVuetify } from "vuetify";
import { VApp } from "vuetify/components";
import VersionMismatchBar from "@/shared/version/VersionMismatchBar.vue";
import { isCompatibleCoreVersion } from "@/shared/version/version-compatibility";

describe("isCompatibleCoreVersion", () => {
  it("accepts any patch release of the same major and minor version", () => {
    expect(isCompatibleCoreVersion("0.1.0", "0.1.0")).toBe(true);
    expect(isCompatibleCoreVersion("0.1.2", "0.1.7")).toBe(true);
    expect(isCompatibleCoreVersion("1.4.0", "1.4.3-rc.1")).toBe(true);
  });

  it("rejects a different major or minor version", () => {
    expect(isCompatibleCoreVersion("0.1.0", "0.2.0")).toBe(false);
    expect(isCompatibleCoreVersion("1.0.0", "2.0.0")).toBe(false);
    expect(isCompatibleCoreVersion("0.10.0", "0.1.0")).toBe(false);
  });

  it("rejects versions it cannot read", () => {
    expect(isCompatibleCoreVersion("0.1.0", "dev")).toBe(false);
    expect(isCompatibleCoreVersion("unknown", "unknown")).toBe(false);
  });
});

describe("version mismatch bar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function mountWithCoreVersion(version: string) {
    const health = { status: "ok", service: "openmeshtak", version, timestamp: new Date().toISOString() };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(health), { headers: { "Content-Type": "application/json" } }))));
    // The system bar is a layout component and needs the surrounding v-app.
    const wrapper = mount(defineComponent({ components: { VApp, VersionMismatchBar }, template: "<v-app><VersionMismatchBar /></v-app>" }), {
      global: { plugins: [createVuetify()] },
    });
    await flushPromises();
    return wrapper;
  }

  it("warns when Core runs another release line", async () => {
    const wrapper = await mountWithCoreVersion("9.9.0");
    expect(wrapper.text()).toContain(`This Web app (${__APP_VERSION__}) does not match the server (9.9.0)`);
  });

  it("stays hidden for a compatible Core", async () => {
    const wrapper = await mountWithCoreVersion(__APP_VERSION__);
    expect(wrapper.text()).toBe("");
  });
});
