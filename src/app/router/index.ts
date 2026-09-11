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
      { path: "", name: "home", component: () => import("@/app/layouts/PlaceholderView.vue") },
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
