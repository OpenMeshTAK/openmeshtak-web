import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import TakEnrollmentAction from "@/modules/tak-server/components/TakEnrollmentAction.vue";
import type * as Realtime from "@/shared/realtime/realtime";

vi.mock("@/shared/realtime/realtime", async (importOriginal) => ({
  ...(await importOriginal<typeof Realtime>()),
  connectRealtime: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

/** jsdom cannot run Vuetify's dialog overlay; the stub renders the content while open. */
const DialogStub = { props: ["modelValue"], template: `<div v-if="modelValue" class="dialog"><slot /></div>` };

function enrollment() {
  return {
    username: "peter",
    expiresAt: null,
    hostName: "tak.example.org",
    enrollmentPort: 8446,
    martiPort: 8443,
    streamingPort: 8089,
    atakEnrollmentUrl: "tak://com.atakmap.app/enroll?host=tak.example.org",
    itakQrString: "OpenMeshTak_tak.example.org,tak.example.org,8089,SSL",
    unusedPackageHours: 24,
  };
}

async function openDialog(body: ReturnType<typeof enrollment>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 201, headers: { "Content-Type": "application/json" } })),
  );
  const wrapper = mount(TakEnrollmentAction, {
    global: { plugins: [createVuetify()], stubs: { VDialog: DialogStub, RouterLink: true } },
  });
  await wrapper.find("button").trigger("click");
  await flushPromises();
  return wrapper;
}

async function chooseApp(wrapper: Awaited<ReturnType<typeof openDialog>>, app: string) {
  const option = wrapper.findAll("[role='radio']").find((button) => button.text().includes(app));
  await option?.trigger("click");
  await flushPromises();
}

describe("Connect a TAK app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers WinTAK only its connection package", async () => {
    const wrapper = await openDialog(enrollment());
    await chooseApp(wrapper, "WinTAK");

    const tabs = wrapper.findAll("[role='tab']").map((tab) => tab.text());
    expect(tabs).toEqual(["Connection package"]);
    const download = wrapper.find("a[href='/api/v1/me/wintak-connection-package']");
    expect(download.text()).toContain("Download WinTAK package");
    expect(wrapper.text()).toContain("import it in WinTAK");
  });

  it("offers further iTAK packages and says when an unused one expires", async () => {
    const wrapper = await openDialog(enrollment());
    await chooseApp(wrapper, "iTAK");
    await wrapper.findAll("[role='tab']").find((tab) => tab.text() === "Connection package")?.trigger("click");
    await flushPromises();

    expect(wrapper.find("a[href='/api/v1/me/itak-connection-package']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Import it within 24 hours");
    expect(wrapper.text()).not.toContain("Revoke");
  });
});
