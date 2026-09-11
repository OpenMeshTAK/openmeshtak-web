import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import vuetify from "vite-plugin-vuetify";

/**
 * In development the Vite server proxies `/api` to Core so the browser stays same-origin, exactly
 * like the Caddy deployment. Better Auth cookies and origin checks therefore behave identically.
 * Set Core's PUBLIC_ORIGIN to the Vite origin (http://localhost:5173) while developing.
 */
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
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
    server: { deps: { inline: ["vuetify"] } },
  },
});
