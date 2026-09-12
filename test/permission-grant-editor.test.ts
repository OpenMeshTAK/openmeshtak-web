import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createVuetify } from "vuetify";
import type { Schemas } from "@/shared/api/types";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";

type Grant = Schemas["PermissionGrantDto"];

const events = [{ id: "event-1", name: "LightSim 2027" }];

/** Renders dialog content inline instead of teleporting it to the document body. */
const inlineDialog = {
  VDialog: {
    props: ["modelValue"],
    template: '<div v-if="modelValue"><slot /></div>',
  },
};

function mountEditor(grants: Grant[]) {
  const updates: Grant[][] = [];
  const wrapper = mount(PermissionGrantEditor, {
    props: {
      events,
      modelValue: grants,
      "onUpdate:modelValue": (value: Grant[]) => {
        updates.push(value);
        void wrapper.setProps({ modelValue: value });
      },
    },
    global: { plugins: [createVuetify()], stubs: inlineDialog },
  });
  return { wrapper, updates };
}

type Wrapper = ReturnType<typeof mountEditor>["wrapper"];

async function openScope(wrapper: Wrapper, row: number): Promise<void> {
  await wrapper.findAll(".scope-row")[row]!.find("button").trigger("click");
}

function button(wrapper: Wrapper, text: string) {
  return wrapper.findAll("button").find((candidate) => candidate.text() === text)!;
}

function checkbox(wrapper: Wrapper, label: string) {
  return wrapper.find(`input[aria-label="${label}"]`);
}

describe("permission grant editor", () => {
  it("lists one row per scope with its permission count", () => {
    const { wrapper } = mountEditor([
      { permission: "users.read", eventId: null },
      { permission: "members.sync", eventId: "event-1" },
      { permission: "members.read", eventId: "event-1" },
    ]);

    const rows = wrapper.findAll(".scope-row").map((row) => row.text());
    expect(rows[0]).toContain("All events");
    expect(rows[0]).toContain("1 permission");
    expect(rows[1]).toContain("LightSim 2027");
    expect(rows[1]).toContain("2 permissions");
  });

  it("selects every permission of an area and applies the draft", async () => {
    const { wrapper, updates } = mountEditor([]);

    await openScope(wrapper, 0);
    await checkbox(wrapper, "All Events permissions").setValue(true);
    expect(updates).toEqual([]);
    await button(wrapper, "Apply").trigger("click");

    expect(updates.at(-1)).toEqual([
      { permission: "events.read", eventId: null },
      { permission: "events.manage", eventId: null },
      { permission: "events.reactivate", eventId: null },
    ]);
  });

  it("discards the draft on cancel", async () => {
    const { wrapper, updates } = mountEditor([]);

    await openScope(wrapper, 0);
    await checkbox(wrapper, "View users").setValue(true);
    await button(wrapper, "Cancel").trigger("click");

    expect(updates).toEqual([]);
  });

  it("edits an event scope and disables instance-only permissions there", async () => {
    const { wrapper } = mountEditor([{ permission: "members.sync", eventId: "event-1" }]);

    await openScope(wrapper, 1);

    expect(checkbox(wrapper, "Synchronize members").element).toHaveProperty("checked", true);
    expect(checkbox(wrapper, "View users").attributes("disabled")).toBeDefined();
  });

  it("removes an event scope together with its grants", async () => {
    const { wrapper, updates } = mountEditor([{ permission: "members.sync", eventId: "event-1" }]);

    await wrapper.find('button[aria-label="Remove permissions for LightSim 2027"]').trigger("click");

    expect(updates.at(-1)).toEqual([]);
  });
});
