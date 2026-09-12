import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createVuetify } from "vuetify";
import type { Schemas } from "@/shared/api/types";
import PermissionGrantEditor from "@/shared/components/PermissionGrantEditor.vue";

type Grant = Schemas["PermissionGrantDto"];

const events = [{ id: "event-1", name: "LightSim 2027" }];

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
    global: { plugins: [createVuetify()] },
  });
  return { wrapper, updates };
}

function checkbox(wrapper: ReturnType<typeof mountEditor>["wrapper"], label: string, block = 0) {
  const blocks = wrapper.findAll(".v-card");
  return blocks[block]!.find(`input[aria-label="${label}"]`);
}

describe("permission grant editor", () => {
  it("selects every permission of an area with its checkbox", async () => {
    const { wrapper, updates } = mountEditor([]);

    await checkbox(wrapper, "All Events permissions").setValue(true);

    expect(updates.at(-1)).toEqual([
      { permission: "events.read", eventId: null },
      { permission: "events.manage", eventId: null },
      { permission: "events.reactivate", eventId: null },
    ]);
  });

  it("keeps mixed scopes in separate blocks and disables instance-only rows per event", () => {
    const { wrapper } = mountEditor([
      { permission: "users.read", eventId: null },
      { permission: "members.sync", eventId: "event-1" },
    ]);

    expect(wrapper.text()).toContain("LightSim 2027");
    expect(checkbox(wrapper, "View users", 0).element).toHaveProperty("checked", true);
    expect(checkbox(wrapper, "Synchronize members", 1).element).toHaveProperty("checked", true);
    expect(checkbox(wrapper, "View users", 1).attributes("disabled")).toBeDefined();
  });

  it("removes an event block together with its grants", async () => {
    const { wrapper, updates } = mountEditor([{ permission: "members.sync", eventId: "event-1" }]);

    await wrapper.find('button[aria-label="Remove permissions for LightSim 2027"]').trigger("click");

    expect(updates.at(-1)).toEqual([]);
  });
});
