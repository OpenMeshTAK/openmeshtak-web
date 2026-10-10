import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { canOpenRoute } from "@/app/router/access";
import { useSession } from "@/modules/auth/session";
import type { Permission, Schemas } from "@/shared/api/types";
import SettingsLayout from "@/shared/settings/SettingsLayout.vue";
import EventDetailView from "@/modules/events/views/EventDetailView.vue";
import EventOverviewPanel from "@/modules/events/components/EventOverviewPanel.vue";
import EventRolesPanel from "@/modules/event-roles/EventRolesPanel.vue";
import EventGroupsPanel from "@/modules/event-groups/EventGroupsPanel.vue";
import TakSettingsPanel from "@/modules/tak-configuration/TakSettingsPanel.vue";
import TakGroupsSettings from "@/modules/tak-configuration/TakGroupsSettings.vue";
import MeshtasticPanel from "@/modules/meshtastic-configuration/MeshtasticPanel.vue";
import MeshtasticChannelsPanel from "@/modules/meshtastic-channels/MeshtasticChannelsPanel.vue";
import TakConnectionSection from "@/modules/tak-configuration/TakConnectionSection.vue";
import PresetsSection from "@/modules/settings-presets/PresetsSection.vue";
import PresetActionTile from "@/modules/settings-presets/PresetActionTile.vue";
import TrafficRecordingOption from "@/modules/tak-server/components/TrafficRecordingOption.vue";

const EVENT = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";
const session = useSession();
const event: Schemas["EventDto"] = {
  id: EVENT, name: "Test event", slug: "test", timeZone: "UTC", status: "active", version: 1,
  startsAt: null, endsAt: null, takLoginTokenDays: 14, permanentAccounts: false,
  meshtasticEnabled: true, createdAt: "2026-10-10T00:00:00Z", updatedAt: "2026-10-10T00:00:00Z",
};
const catalog: Schemas["AtakPreferenceCatalogDto"] = { atakVersion: "5.5", topics: [], screenItems: [], blockedKeys: [] };
const radio: Schemas["MeshtasticConfigurationDto"] = {
  eventId: EVENT, firmwareVersion: "2.8", effectiveMinimumVersion: "2.8.1", profileId: "2.8",
  verified: true, settings: {}, secretFields: [], secretsSet: [], problems: [], version: 1, updatedAt: null,
};
const wrappers: VueWrapper[] = [];
const mountOptions = { global: { renderStubDefaultSlot: true } };

/** Unexpected reads fail, so an optional denied request cannot silently pass the test. */
async function signIn(permissions: Array<{ permission: Permission; eventId: string | null }>) {
  const fetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname.replace("/api/v1", "");
    let body: unknown;
    if (path === "/principal") body = { type: "user", id: OTHER, name: "Operator", username: "operator", hasPassword: true, permissions };
    else if (path === "/setup") body = { configured: true };
    else if (path === `/events/${EVENT}`) body = event;
    else if (path.endsWith("/groups") || path.endsWith("/roles") || path.endsWith("/data-packages")) body = { items: [], page: { nextCursor: null } };
    else if (path === "/tak/atak-preference-catalog") body = catalog;
    else if (path.endsWith("/tak/atak-preferences")) body = { eventId: EVENT, version: 1, entries: [] };
    else if (path.endsWith("/meshtastic/configuration")) body = radio;
    else if (path.endsWith("/tak-traffic/recording")) body = { enabled: true, retentionDays: 30, storedItems: 10, version: 1 };
    else throw new Error(`Unexpected API request: ${path}`);
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  await session.refresh();
  fetch.mockClear();
  return fetch;
}

function grants(...permissions: Permission[]) {
  return permissions.map((permission) => ({ permission, eventId: EVENT }));
}

function keep(wrapper: VueWrapper) {
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe("scoped route hints", () => {
  it("distinguishes an instance grant, any-event navigation and a specific event", async () => {
    await signIn(grants("events.read", "events.manage"));
    expect(session.can("events.manage")).toBe(true);
    expect(session.can("events.manage", null)).toBe(false);
    expect(session.can("events.manage", OTHER)).toBe(false);
    expect(canOpenRoute(router.resolve("/admin/events"), session.can)).toBe(true);
    expect(canOpenRoute(router.resolve(`/admin/events/${EVENT}`), session.can)).toBe(true);
    expect(canOpenRoute(router.resolve(`/admin/events/${OTHER}`), session.can)).toBe(false);
    await signIn([{ permission: "events.read", eventId: null }]);
    expect(canOpenRoute(router.resolve(`/admin/events/${OTHER}`), session.can)).toBe(true);
  });

  it.each([
    ["data-packages", "data-packages.read", "missions.read"],
    ["missions/editor", "missions.read", "data-packages.read"],
    ["history", "tak-traffic.history", "tak-traffic.view"],
    ["live", "tak-traffic.view", "tak-traffic.history"],
  ] as const)("gates direct %s links by their own permission and event", async (path, allowed, unrelated) => {
    const route = router.resolve(`/admin/events/${EVENT}/${path}`);
    await signIn(grants(unrelated));
    expect(canOpenRoute(route, session.can)).toBe(false);
    await signIn([{ permission: allowed, eventId: OTHER }]);
    expect(canOpenRoute(route, session.can)).toBe(false);
    await signIn(grants(allowed));
    expect(canOpenRoute(route, session.can)).toBe(true);
  });

  it("redirects a denied direct settings link before loading its view", async () => {
    await signIn([{ permission: "events.manage", eventId: null }]);
    await router.push("/admin/settings/presets");
    expect(router.currentRoute.value.name).toBe("access-denied");
    await signIn([{ permission: "presets.read", eventId: null }]);
    await router.push("/admin/settings/presets");
    expect(router.currentRoute.value.name).toBe("settings-presets");
  });
});

describe("event views", () => {
  it("hides denied tabs and falls back from a direct Members URL without reading members", async () => {
    const fetch = await signIn(grants("events.read", "missions.read", "tak-traffic.history", "offline-snapshots.prepare"));
    await router.push(`/admin/events/${EVENT}/members`);
    const wrapper = keep(shallowMount(EventDetailView, {
      global: { plugins: [router], renderStubDefaultSlot: true, stubs: { ViewHeader: false } },
    }));
    await flushPromises();
    expect(wrapper.findAll("v-tab-stub").map((tab) => tab.attributes("value"))).toEqual([
      "overview", "settings", "roles", "groups", "meshtastic", "tak", "missions",
    ]);
    expect(wrapper.find("v-tabs-stub").attributes("modelvalue")).toBe("overview");
    expect(wrapper.text()).toContain("History");
    expect(wrapper.text()).toContain("Offline HQ");
    expect(wrapper.text()).not.toContain("Live TAK");
    expect(fetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual([`/api/v1/events/${EVENT}`]);
  });

  it("lets role editors edit roles while event and group settings stay read-only", async () => {
    await signIn(grants("events.read", "event-roles.manage"));
    await router.push(`/admin/events/${EVENT}/roles`);
    const wrapper = keep(shallowMount(EventDetailView, {
      global: { plugins: [router], renderStubDefaultSlot: true },
    }));
    await flushPromises();
    expect(wrapper.findComponent(EventRolesPanel).props("editable")).toBe(true);
    expect(wrapper.findComponent(EventGroupsPanel).props("editable")).toBe(false);
    expect(wrapper.text()).not.toContain("Save changes");
    await signIn(grants("events.read", "events.manage"));
    await flushPromises();
    expect(wrapper.findComponent(EventRolesPanel).props("editable")).toBe(false);
    expect(wrapper.findComponent(EventGroupsPanel).props("editable")).toBe(false);
  });

  it("loads overview counts only for readable features", async () => {
    const fetch = await signIn(grants("events.read", "missions.read"));
    const wrapper = keep(shallowMount(EventOverviewPanel, { props: { event, visible: true }, ...mountOptions }));
    await flushPromises();
    const requests = fetch.mock.calls.map(([request]) => new URL(request.url));
    expect(requests.map(({ pathname }) => pathname)).not.toContain(`/api/v1/events/${EVENT}/members`);
    expect(requests.map(({ pathname }) => pathname)).not.toContain(`/api/v1/events/${EVENT}/sync-issues`);
    expect(requests.filter(({ pathname }) => pathname.endsWith("/data-packages")).map(({ searchParams }) => searchParams.get("kind"))).toEqual(["mission"]);
    expect(wrapper.text()).toContain("Missions");
    expect(wrapper.text()).not.toContain("Members");
    expect(wrapper.text()).not.toContain("Open sync issues");
  });
});

describe("settings and traffic actions", () => {
  it("keeps TAK settings and TAK group writes separate and skips denied member reads", async () => {
    const fetch = await signIn(grants("events.read", "tak-groups.manage"));
    const wrapper = keep(shallowMount(TakSettingsPanel, { props: { eventId: EVENT, editable: true }, ...mountOptions }));
    await flushPromises();
    expect(wrapper.findComponent(TakGroupsSettings).props()).toMatchObject({ editable: false, groupsEditable: true });
    expect(fetch.mock.calls.some(([request]) => new URL(request.url).pathname.endsWith("/members"))).toBe(false);
    await wrapper.findComponent(SettingsLayout).vm.$emit("update:modelValue", "presets");
    await flushPromises();
    expect(wrapper.findComponent(PresetsSection).props("editable")).toBe(false);
    await signIn(grants("events.read", "tak-settings.manage"));
    await wrapper.findComponent(SettingsLayout).vm.$emit("update:modelValue", "groups");
    await flushPromises();
    expect(wrapper.findComponent(TakGroupsSettings).props()).toMatchObject({ editable: true, groupsEditable: false });
  });

  it("opens channels without requesting the restricted firmware catalog and gates TAK independently", async () => {
    const fetch = await signIn(grants("events.read", "meshtastic-channels.manage"));
    const wrapper = keep(shallowMount(MeshtasticPanel, { props: { eventId: EVENT, editable: true }, ...mountOptions }));
    await flushPromises();
    expect(fetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual([`/api/v1/events/${EVENT}/meshtastic/configuration`]);
    await wrapper.findComponent(SettingsLayout).vm.$emit("update:modelValue", "channels");
    await flushPromises();
    expect(wrapper.findComponent(MeshtasticChannelsPanel).props("editable")).toBe(true);
    await wrapper.findComponent(SettingsLayout).vm.$emit("update:modelValue", "tak-connection");
    await flushPromises();
    expect(wrapper.findComponent(TakConnectionSection).props("editable")).toBe(false);
    await wrapper.setProps({ editable: false });
    await wrapper.findComponent(SettingsLayout).vm.$emit("update:modelValue", "channels");
    await flushPromises();
    expect(wrapper.findComponent(MeshtasticChannelsPanel).props("editable")).toBe(false);
  });

  it("offers file import independently of library read and write permissions", async () => {
    await signIn(grants("tak-settings.manage"));
    const wrapper = keep(shallowMount(PresetsSection, { props: { eventId: EVENT, kind: "tak", editable: true, dirty: false }, ...mountOptions }));
    const ids = () => wrapper.findAllComponents(PresetActionTile).map((tile) => tile.props("settingId"));
    expect(ids()).toEqual(["presets:import-file", "presets:download"]);
    await signIn([{ permission: "presets.read", eventId: null }]);
    await flushPromises();
    expect(ids()).toContain("presets:import-library");
    expect(ids()).not.toContain("presets:save");
    await signIn([{ permission: "presets.manage", eventId: null }]);
    await flushPromises();
    expect(ids()).toContain("presets:save");
    expect(ids()).not.toContain("presets:import-library");
  });

  it("separates recording controls, history, exports and deletion", async () => {
    await signIn(grants("tak-traffic.view", "events.manage"));
    const wrapper = keep(shallowMount(TrafficRecordingOption, { props: { eventId: EVENT }, ...mountOptions }));
    await flushPromises();
    expect(wrapper.find("v-switch-stub").attributes("disabled")).toBe("true");
    expect(wrapper.findAll("v-btn-stub").map((button) => button.text())).toEqual([]);
    await signIn(grants("tak-traffic.recording"));
    await flushPromises();
    expect(wrapper.find("v-switch-stub").attributes("disabled")).toBe("false");
    expect(wrapper.findAll("v-btn-stub").map((button) => button.text())).toEqual([]);
    await signIn(grants("tak-traffic.history", "tak-traffic.export", "tak-traffic.delete"));
    await flushPromises();
    expect(wrapper.findAll("v-btn-stub").map((button) => button.text())).toEqual(["Export", "History", "Delete stored"]);
  });
});
