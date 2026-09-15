import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useSession } from "@/modules/auth/session";
import { isSetupComplete } from "@/modules/setup/setup.api";

declare module "vue-router" {
  interface RouteMeta {
    /** Reachable without a session (setup, sign-in, claim links). */
    public?: boolean;
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
  // The editor uses the whole window; it brings its own header with a way back.
  {
    path: "/admin/events/:eventId/missions/:missionId",
    name: "mission-editor",
    component: () => import("@/modules/editor/MissionEditorView.vue"),
  },
  {
    path: "/",
    component: () => import("@/app/layouts/AppShell.vue"),
    children: [
      { path: "", name: "home", component: () => import("@/modules/dashboard/DashboardView.vue") },
      {
        path: "account",
        name: "account",
        component: () => import("@/modules/account/AccountView.vue"),
      },
      {
        path: "admin/events",
        name: "events",
        component: () => import("@/modules/events/views/EventListView.vue"),
      },
      {
        path: "admin/user-groups",
        name: "user-groups",
        component: () => import("@/modules/user-groups/UserGroupListView.vue"),
      },
      {
        path: "admin/user-groups/:userGroupId",
        name: "user-group-detail",
        component: () => import("@/modules/user-groups/UserGroupDetailView.vue"),
      },
      {
        path: "admin/service-accounts",
        name: "service-accounts",
        component: () => import("@/modules/service-accounts/ServiceAccountListView.vue"),
      },
      {
        path: "admin/service-accounts/:serviceAccountId",
        name: "service-account-detail",
        component: () => import("@/modules/service-accounts/ServiceAccountDetailView.vue"),
      },
      {
        path: "admin/events/:eventId",
        name: "event-detail",
        component: () => import("@/modules/events/views/EventDetailView.vue"),
      },
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
