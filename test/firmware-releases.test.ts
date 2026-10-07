import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import { describe, expect, it } from "vitest";
import FirmwareReleaseTable from "@/modules/meshtastic-configuration/components/FirmwareReleaseTable.vue";
import type { FirmwareReleaseListDto } from "@/modules/meshtastic-configuration/firmware-releases.api";

function releaseList(overrides: Partial<FirmwareReleaseListDto> = {}): FirmwareReleaseListDto {
  return {
    status: "current",
    fetchedAt: "2026-10-07T12:00:00.000Z",
    releases: [
      {
        version: "2.8.1",
        build: "tested1",
        channel: "stable",
        support: "tested",
        profileId: "meshtastic-2.8",
        releaseUrl: "https://github.com/meshtastic/firmware/releases/tag/v2.8.1.tested1",
      },
      {
        version: "2.8.2",
        build: "support2",
        channel: "alpha",
        support: "supported",
        profileId: "meshtastic-2.8",
        releaseUrl: "https://github.com/meshtastic/firmware/releases/tag/v2.8.2.support2",
      },
      {
        version: "3.0.0",
        build: "future30",
        channel: "alpha",
        support: "unsupported",
        profileId: null,
        releaseUrl: "https://github.com/meshtastic/firmware/releases/tag/v3.0.0.future30",
      },
    ],
    ...overrides,
  };
}

describe("published Meshtastic firmware releases", () => {
  it("distinguishes tested, supported and unsupported releases", () => {
    const wrapper = mount(FirmwareReleaseTable, {
      props: { list: releaseList() },
      global: { plugins: [createVuetify()] },
    });

    expect(wrapper.text()).toContain("Tested on a device");
    expect(wrapper.text()).toContain("Supported");
    expect(wrapper.text()).toContain("Not supported");
    expect(wrapper.find('a[aria-label="Release notes for 2.8.1"]').attributes("href")).toContain("v2.8.1.tested1");
  });

  it("shows stale-cache context and initially limits long lists", async () => {
    const releases = Array.from({ length: 8 }, (_, index) => ({
      version: `2.8.${String(index + 1)}`,
      build: `build${String(index + 1)}`,
      channel: "stable" as const,
      support: "supported" as const,
      profileId: "meshtastic-2.8",
      releaseUrl: `https://github.com/meshtastic/firmware/releases/tag/v2.8.${String(index + 1)}.build${String(index + 1)}`,
    }));
    const wrapper = mount(FirmwareReleaseTable, {
      props: { list: releaseList({ status: "cached", releases }) },
      global: { plugins: [createVuetify()] },
    });

    expect(wrapper.text()).toContain("the Meshtastic flasher could not be reached");
    expect(wrapper.findAll("tbody tr")).toHaveLength(6);

    const showAll = wrapper.findAll("button").find((button) => button.text() === "Show all 8");
    expect(showAll).toBeDefined();
    await showAll!.trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(8);
  });
});
