import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useSession } from "@/modules/auth/session";
import { isSetupComplete } from "@/modules/setup/setup.api";

declare module "vue-router" {
  interface RouteMeta {
    /** Reachable without a session (setup, sign-in, claim links). */
    public?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("@/app/layouts/PublicLayout.vue"),
    meta: { public: true },
    children: [
      { path: "setup", name: "setup", component: () => import("@/modules/setup/SetupView.vue") },
      { path: "sign-in", name: "sign-in", component: () => import("@/modules/auth/SignInView.vue") },
      { path: "claim", name: "claim", component: () => import("@/modules/member-claims/ClaimView.vue") },
    ],
  },
  {
    path: "/",
    component: () => import("@/app/layouts/AppShell.vue"),
    children: [
      { path: "", name: "home", component: () => import("@/modules/dashboard/DashboardView.vue") },
      {
        path: "admin/events",
        name: "events",
        component: () => import("@/modules/events/views/EventListView.vue"),
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
