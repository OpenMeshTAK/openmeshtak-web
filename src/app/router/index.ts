import {
  mdiAccount,
  mdiAccountCog,
  mdiAccountGroup,
  mdiCalendarMultiple,
  mdiCogOutline,
  mdiEmailOutline,
  mdiKeyChain,
  mdiLayersOutline,
  mdiServerNetwork,
  mdiViewDashboard,
} from "@mdi/js";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useSession } from "@/modules/auth/session";
import { isSetupComplete } from "@/modules/setup/setup.api";
import type { RouteNavigation } from "./navigation";

declare module "vue-router" {
  interface RouteMeta {
    /** Reachable without a session (setup, sign-in, claim links). */
    public?: boolean;
    /** Shows the route in the main navigation; see `navigationFromRoutes`. */
    navigation?: RouteNavigation;
  }
}

/**
 * Each public page gets its own top-level record. Sharing the "/" parent with the app shell made a
 * fresh visit to "/" resolve to the empty public layout instead of the dashboard.
 */
function publicPage(path: string, name: string, view: RouteRecordRaw["component"]): RouteRecordRaw {
  return {
    path,
    component: () => import("@/app/layouts/PublicLayout.vue"),
    meta: { public: true },
    children: [{ path: "", name, component: view }],
  } as RouteRecordRaw;
}

const routes: RouteRecordRaw[] = [
  publicPage("/setup", "setup", () => import("@/modules/setup/SetupView.vue")),
  publicPage("/sign-in", "sign-in", () => import("@/modules/auth/SignInView.vue")),
  publicPage("/claim", "claim", () => import("@/modules/member-claims/ClaimView.vue")),
  publicPage("/forgot-password", "forgot-password", () => import("@/modules/auth/ForgotPasswordView.vue")),
  publicPage("/reset-password", "reset-password", () => import("@/modules/auth/ResetPasswordView.vue")),
  // Signed in, but shown in the simple public layout: the account is not usable before setup.
  {
    path: "/account/setup",
    component: () => import("@/app/layouts/PublicLayout.vue"),
    children: [{ path: "", name: "account-setup", component: () => import("@/modules/account/AccountSetupView.vue") }],
  },
  // The editor uses the whole window; it brings its own header with a way back.
  {
    path: "/admin/events/:eventId/data-packages",
    name: "event-editor",
    component: () => import("@/modules/editor/EventEditorView.vue"),
  },
  {
    path: "/admin/events/:eventId/live",
    name: "event-live",
    component: () => import("@/modules/tak-server/LiveTrafficView.vue"),
  },
  {
    path: "/admin/events/:eventId/data-packages/:packageId",
    name: "package-editor",
    component: () => import("@/modules/editor/PackageEditorView.vue"),
  },
  {
    path: "/",
    component: () => import("@/app/layouts/AppShell.vue"),
    children: [
      {
        path: "",
        name: "home",
        component: () => import("@/modules/dashboard/DashboardView.vue"),
        meta: { navigation: { title: "Dashboard", icon: mdiViewDashboard } },
      },
      {
        path: "account",
        name: "account",
        component: () => import("@/modules/account/AccountView.vue"),
      },
      // List and detail pages share a parent record without a component, so the navigation
      // item of the list stays active on its detail pages.
      {
        path: "admin/events",
        meta: { navigation: { title: "Events", icon: mdiCalendarMultiple, permission: "events.read" } },
        children: [
          { path: "", name: "events", component: () => import("@/modules/events/views/EventListView.vue") },
          { path: ":eventId", name: "event-detail", component: () => import("@/modules/events/views/EventDetailView.vue") },
        ],
      },
      // A group without a page of its own: its path only prefixes the children, so the URLs stay
      // /admin/users and /admin/user-groups.
      {
        path: "admin",
        meta: { navigation: { title: "User management", icon: mdiAccountCog } },
        children: [
          {
            path: "users",
            name: "users",
            component: () => import("@/modules/users/UserListView.vue"),
            meta: { navigation: { title: "Users", icon: mdiAccount, permission: "users.read" } },
          },
          {
            path: "user-groups",
            meta: { navigation: { title: "User groups", icon: mdiAccountGroup, permission: "user-groups.read" } },
            children: [
              { path: "", name: "user-groups", component: () => import("@/modules/user-groups/UserGroupListView.vue") },
              {
                path: ":userGroupId",
                name: "user-group-detail",
                component: () => import("@/modules/user-groups/UserGroupDetailView.vue"),
              },
            ],
          },
        ],
      },
      // Child routes with their own navigation entry turn "Settings" into a submenu.
      {
        path: "admin/settings",
        name: "settings",
        component: () => import("@/modules/settings/SettingsView.vue"),
        meta: { navigation: { title: "Settings", icon: mdiCogOutline } },
        children: [
          {
            path: "email",
            name: "email-settings",
            component: () => import("@/modules/email/EmailSettingsPanel.vue"),
            meta: { navigation: { title: "Email", icon: mdiEmailOutline, permission: "email.manage" } },
          },
          {
            path: "base-map",
            name: "base-map",
            component: () => import("@/modules/map-settings/MapSettingsPanel.vue"),
            meta: { navigation: { title: "Base map", icon: mdiLayersOutline, permission: "settings.manage" } },
          },
          {
            path: "tak-server",
            name: "tak-server",
            component: () => import("@/modules/tak-server/TakServerPanel.vue"),
            meta: { navigation: { title: "TAK server", icon: mdiServerNetwork, permission: "tak-server.manage" } },
          },
          {
            path: "api-clients",
            meta: { navigation: { title: "API access", icon: mdiKeyChain, permission: "api-clients.manage" } },
            children: [
              {
                path: "",
                name: "api-clients",
                component: () => import("@/modules/api-clients/ApiClientListView.vue"),
              },
              {
                path: ":apiClientId",
                name: "api-client-detail",
                component: () => import("@/modules/api-clients/ApiClientDetailView.vue"),
              },
            ],
          },
        ],
      },
      // Earlier standalone settings pages; keep bookmarks working.
      { path: "admin/email", redirect: { name: "email-settings" } },
      { path: "admin/base-map", redirect: { name: "base-map" } },
      { path: "admin/tak-server", redirect: { name: "tak-server" } },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({ history: createWebHistory(), routes });

/**
 * Routes an unconfigured installation to setup and anonymous visitors to sign-in. These are
 * conveniences for the user; Core enforces authentication and authorization on every request.
 */
router.beforeEach(async (to) => {
  const setupComplete = await isSetupComplete();
  if (!setupComplete) {
    return to.name === "setup" ? true : { name: "setup" };
  }
  if (to.name === "setup") {
    return { name: "home" };
  }

  if (to.meta.public === true) {
    return true;
  }

  const session = useSession();
  await session.ensureLoaded();
  if (session.state.status !== "authenticated") {
    return { name: "sign-in", query: { redirect: to.fullPath } };
  }
  // A claim creates a deliberately incomplete account. Keep it in the setup screen until it has
  // a password, otherwise closing the access-link session would lock the participant out.
  const needsSetup = session.state.principal?.hasPassword === false;
  if (needsSetup !== (to.name === "account-setup")) {
    return { name: needsSetup ? "account-setup" : "home" };
  }
  return true;
});

/**
 * After a deployment (or a Vite dependency re-optimization in development) old lazily loaded
 * chunks disappear. Loading the target URL once more fetches the new build instead of leaving a
 * blank page.
 */
router.onError((error: unknown, to) => {
  if (error instanceof TypeError && error.message.includes("dynamically imported module")) {
    window.location.assign(to.fullPath);
  }
});
