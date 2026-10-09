import { describe, expect, it } from "vitest";
import { router } from "@/app/router";
import { isNavigationActive, navigationFromRoutes, visibleNavigation } from "@/app/router/navigation";

const navigation = navigationFromRoutes(router.options.routes);

function titles(items: ReturnType<typeof navigationFromRoutes>): unknown[] {
  return items.map((item) => (item.children.length === 0 ? item.title : { [item.title]: titles(item.children) }));
}

describe("navigation from the route table", () => {
  it("lists the shell destinations with User management and Settings as submenus", () => {
    expect(titles(navigation)).toEqual([
      "Dashboard",
      "Events",
      { "User management": ["Users", "User groups"] },
      { Settings: ["General", "TAK server", "Presets", "Server log", "API access"] },
    ]);
    expect(navigation.find((item) => item.title === "Settings")?.children.map((child) => child.path)).toEqual([
      "/admin/settings/general",
      "/admin/settings/tak-server",
      "/admin/settings/presets",
      "/admin/settings/server-log",
      "/admin/settings/api-clients",
    ]);
  });

  it("hides items without permission and submenus left empty", () => {
    const visible = visibleNavigation(navigation, (permission) => permission === "events.read");
    expect(titles(visible)).toEqual(["Dashboard", "Events"]);
    const withEmail = visibleNavigation(navigation, (permission) => permission === "email.manage");
    expect(titles(withEmail)).toEqual(["Dashboard", { Settings: ["General"] }]);
  });

  it.each([
    ["/", "Dashboard"],
    ["/admin/events", "Events"],
    ["/admin/user-groups/00000000-0000-0000-0000-000000000000", "User management"],
    ["/admin/settings/tak-server", "Settings"],
    ["/admin/settings/api-clients/00000000-0000-0000-0000-000000000000", "Settings"],
  ])("marks only the matching item active on %s", (path, title) => {
    const route = router.resolve(path);
    expect(navigation.filter((item) => isNavigationActive(item, route)).map((item) => item.title)).toEqual([title]);
  });
});
