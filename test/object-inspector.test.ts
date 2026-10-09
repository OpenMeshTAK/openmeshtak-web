import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createVuetify } from "vuetify";
import ObjectInspector from "@/modules/editor/components/ObjectInspector.vue";
import type { PackageObjectDto } from "@/modules/data-packages/data-packages.api";

const object = {
  id: "shape", layerId: "layer", kind: "circle", name: "Circle", description: null, tak: null,
  geometry: { type: "Circle", coordinates: [8, 50], radius: 10 },
  style: { color: "#0000FF", strokeWidth: 2, fillOpacity: 0.5, height: 12.5, heightUnit: 4 },
} as PackageObjectDto;

describe("object inspector", () => {
  it("edits metre height independently of the TAK display unit and clears it to unknown", async () => {
    const wrapper = mount(ObjectInspector, { props: { object, layers: [], editable: true }, global: { plugins: [createVuetify()] } });
    const input = wrapper.find('input[id]').element;
    expect(input).toBeDefined();
    const height = wrapper.findAll("input").find((field) => field.attributes("id") === wrapper.findAll("label").find((label) => label.text().startsWith("Height (m)"))?.attributes("for"));
    expect(height).toBeDefined();
    await height!.setValue("-20");
    await height!.trigger("blur");
    expect(wrapper.emitted("change")?.[0]).toEqual([{ style: { ...object.style, height: -20 } }]);
    await height!.setValue("bad");
    await height!.trigger("blur");
    expect(wrapper.text()).toContain("Enter a height between");
    expect(wrapper.emitted("change")).toHaveLength(1);
    await height!.setValue("");
    await height!.trigger("blur");
    expect(wrapper.emitted("change")?.[1]).toEqual([{ style: { ...object.style, height: null } }]);
    wrapper.unmount();
  });
});
