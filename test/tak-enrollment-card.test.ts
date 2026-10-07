import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import TakClientCertificatesTable from "@/modules/tak-server/components/TakClientCertificatesTable.vue";
import TakEnrollmentCard from "@/modules/tak-server/components/TakEnrollmentCard.vue";

function certificate(id: string, clientUid: string, status: "valid" | "revoked") {
  return {
    id,
    userId: "user",
    userDisplayName: "Peter",
    clientUid,
    serialNumber: id,
    fingerprintSha256: id,
    status,
    notBefore: "2026-10-07T00:00:00Z",
    notAfter: "2027-10-07T00:00:00Z",
    revokedAt: status === "revoked" ? "2026-10-07T00:00:00Z" : null,
    revocationReason: null,
    issuedForOldEndpoint: false,
  };
}

const android = "ANDROID-128a38570dd7729c";
const certificates = [
  certificate("1", "0B60EDD1-CB05-474C-AF0F-CF85DC9F3E0E", "valid"),
  certificate("2", android, "valid"),
  certificate("3", android, "valid"),
  certificate("4", android, "revoked"),
  certificate("5", "ANDROID-0000000000000001", "revoked"),
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function mountCard(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const wrapper = mount(TakEnrollmentCard, {
    global: { plugins: [createVuetify()], stubs: { TakEnrollmentAction: true } },
  });
  await flushPromises();
  return wrapper;
}

describe("TAK enrollment card", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists each enrolled device once and folds devices without a valid certificate away", async () => {
    const wrapper = await mountCard(vi.fn(() => Promise.resolve(jsonResponse(certificates))));

    const rows = wrapper.findAll('[role="listitem"]');
    expect(rows.map((row) => row.text().split("…")[0]?.trim())).toEqual(["iOS TAK app", "Android TAK app"]);
    expect(wrapper.text()).toContain("Earlier apps (1)");
  });

  it("revokes every valid certificate of a device", async () => {
    const fetchMock = vi.fn((request: Request) =>
      Promise.resolve(jsonResponse(request.method === "POST" ? certificates[1] : certificates)),
    );
    const wrapper = await mountCard(fetchMock);

    // The confirmation dialog belongs to the list; the card decides which certificates the device has.
    wrapper.findComponent(TakClientCertificatesTable).vm.$emit("revoke", certificates[1]);
    await flushPromises();

    const revoked = fetchMock.mock.calls
      .map(([request]) => request as Request)
      .filter((request) => request.method === "POST")
      .map((request) => request.url);
    expect(revoked).toHaveLength(2);
    expect(revoked.some((url) => url.includes("/tak-certificates/2/"))).toBe(true);
    expect(revoked.some((url) => url.includes("/tak-certificates/3/"))).toBe(true);
  });
});
