import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { createVuetify } from "vuetify";
import { VApp } from "vuetify/components";
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

  function serveCoreVersion(version: string): void {
    const health = { status: "ok", service: "openmeshtak", version, timestamp: new Date().toISOString() };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(health), { headers: { "Content-Type": "application/json" } }))));
  }

  // The version seen first is remembered per page load, so every test starts with fresh modules.
  async function mountWithCoreVersion(version: string) {
    vi.resetModules();
    const { default: VersionMismatchBar } = await import("@/shared/version/VersionMismatchBar.vue");
    serveCoreVersion(version);
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

  it("offers a reload in a lasting toast, once, when the server was updated while the page was open", async () => {
    const wrapper = await mountWithCoreVersion(__APP_VERSION__);
    const { checkCoreVersion } = await import("@/shared/version/core-version");
    const { useToastQueue } = await import("@/shared/feedback/toast");
    serveCoreVersion("9.9.1");
    await checkCoreVersion();
    await checkCoreVersion();
    await flushPromises();
    const toasts = useToastQueue().value;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ text: "OpenMeshTak was updated to 9.9.1. Reload to use the new version.", timeout: -1 });
    expect(toasts[0]?.action?.label).toBe("Reload");
    expect(wrapper.text()).toBe("");
  });
});
