import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createVuetify } from "vuetify";
import DataTable from "@/shared/components/DataTable.vue";

interface Row {
  id: string;
  name: string;
  hidden: string;
}

const headers = [
  { title: "Name", key: "name" },
  { title: "Actions", key: "actions", sortable: false },
];

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `LOADSIM-${String(index + 1).padStart(3, "0")}`,
    hidden: index === 4 ? "secret-match" : "",
  }));
}

function mountTable(props: Record<string, unknown>) {
  return mount(DataTable, { props: { headers, ...props }, global: { plugins: [createVuetify()] } });
}

function names(wrapper: ReturnType<typeof mountTable>): string[] {
  return wrapper.findAll("tbody tr").map((row) => row.find("td").text());
}

describe("data table", () => {
  it("shows short lists without search field or pages", () => {
    const wrapper = mountTable({ items: rows(3) });

    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find(".v-data-table-footer").exists()).toBe(false);
    expect(names(wrapper)).toHaveLength(3);
  });

  it("pages long lists and searches all of them", async () => {
    const wrapper = mountTable({ items: rows(60) });

    expect(names(wrapper)).toHaveLength(25);
    expect(wrapper.find(".v-data-table-footer").exists()).toBe(true);

    await wrapper.find("input").setValue("sim-05");
    expect(names(wrapper)).toEqual(["LOADSIM-050", "LOADSIM-051", "LOADSIM-052", "LOADSIM-053", "LOADSIM-054", "LOADSIM-055", "LOADSIM-056", "LOADSIM-057", "LOADSIM-058", "LOADSIM-059"]);
  });

  it("searches the texts a view chooses instead of the columns", async () => {
    const wrapper = mountTable({ items: rows(20), searchText: (row: Row) => [row.hidden] });

    await wrapper.find("input").setValue("secret");
    expect(names(wrapper)).toEqual(["LOADSIM-005"]);
  });

  it("sorts by a column when its title is clicked", async () => {
    const wrapper = mountTable({ items: [rows(3)[1], rows(3)[2], rows(3)[0]] });

    await wrapper.find("thead th").trigger("click");
    expect(names(wrapper)).toEqual(["LOADSIM-001", "LOADSIM-002", "LOADSIM-003"]);
    await wrapper.find("thead th").trigger("click");
    expect(names(wrapper)).toEqual(["LOADSIM-003", "LOADSIM-002", "LOADSIM-001"]);
  });
});
