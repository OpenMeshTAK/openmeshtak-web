import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import vuetify from "vite-plugin-vuetify";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Installable app shell. Only the build output (scripts, styles, icons and index.html) is
 * precached; nothing from /api is ever cached, so authenticated responses and secret-bearing
 * downloads never land in the service worker cache (WEB.md, AGENTS.md).
 */
const pwa = VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  includeAssets: ["icons/apple-touch-icon.png"],
  manifest: {
    name: "OpenMeshTak",
    short_name: "OpenMeshTak",
    description: "Event setup for TAK and Meshtastic.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#111418",
    background_color: "#111418",
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "icons/maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],
    // No runtimeCaching: API responses always come from the network.
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
    cleanupOutdatedCaches: true,
  },
});

/**
 * In development the Vite server proxies `/api` to Core so the browser stays same-origin, exactly
 * like the Caddy deployment. Better Auth cookies and origin checks therefore behave identically.
 * Set Core's PUBLIC_ORIGIN to the Vite origin (http://localhost:5173) while developing.
 */
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true }), pwa],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.OPENMESHTAK_CORE_URL ?? "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    server: { deps: { inline: ["vuetify"] } },
  },
});
