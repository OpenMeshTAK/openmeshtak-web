import { hasOfflineBasemap } from "./offline-map-data";
import { readSnapshot } from "./offline-store";
import { checkStoredContent, OFFLINE_SNAPSHOT_FORMAT } from "./prepare-snapshot";

export type CheckState = "ok" | "warning" | "error";

export interface ReadinessCheck {
  id: "app" | "data" | "basemap" | "storage" | "serial";
  label: string;
  state: CheckState;
  detail: string;
}

/**
 * Same-origin scripts and styles this page has loaded so far, including the lazily loaded chunks
 * of the offline view itself. If all of them are in the service worker cache, the app can start
 * here again without a network.
 */
function loadedAssetUrls(): string[] {
  const urls = new Set<string>([new URL("/index.html", window.location.origin).href]);
  for (const entry of performance.getEntriesByType("resource")) {
    const url = new URL(entry.name);
    if (url.origin === window.location.origin && /\.(?:js|css)$/.test(url.pathname) && !url.pathname.startsWith("/api/")) {
      urls.add(url.origin + url.pathname);
    }
  }
  for (const element of document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel=stylesheet]")) {
    const url = new URL("src" in element ? element.src : element.href, window.location.origin);
    if (url.origin === window.location.origin) {
      urls.add(url.origin + url.pathname);
    }
  }
  return [...urls];
}

async function appShellCheck(): Promise<ReadinessCheck> {
  const label = "App available without network";
  if (!("serviceWorker" in navigator) || navigator.serviceWorker.controller === null || typeof caches === "undefined") {
    return {
      id: "app",
      label,
      state: "error",
      detail: "The app is not installed for offline use in this browser yet. Reload the page once while online, then check again.",
    };
  }
  const missing: string[] = [];
  for (const url of loadedAssetUrls()) {
    // Workbox stores unhashed files such as index.html with a revision query parameter.
    if ((await caches.match(url, { ignoreSearch: true })) === undefined) {
      missing.push(new URL(url).pathname);
    }
  }
  return missing.length === 0
    ? { id: "app", label, state: "ok", detail: "All app files this view uses are stored by the browser." }
    : { id: "app", label, state: "error", detail: `${String(missing.length)} app files are not stored yet. Reload while online and check again.` };
}

/** Readiness of the browser and the stored event; checks real stored data, not just a flag. */
export async function checkReadiness(eventId: string): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [await appShellCheck()];

  const record = await readSnapshot(eventId).catch(() => null);
  const stored = record === null ? null : await checkStoredContent(eventId).catch(() => null);
  if (record === null) {
    checks.push({ id: "data", label: "Event data stored", state: "error", detail: "This event is not stored in this browser." });
  } else if (record.snapshot.format !== OFFLINE_SNAPSHOT_FORMAT || !record.complete || stored === null || stored.missing.length > 0) {
    const detail = !record.complete
      ? "The last preparation did not finish."
      : stored !== null && stored.missing.length > 0
        ? `Missing stored content: ${stored.missing.join(", ")}. The browser may have removed it.`
        : "The stored data cannot be read by this app version.";
    checks.push({ id: "data", label: "Event data stored", state: "error", detail: `${detail} Prepare the event again while online.` });
  } else {
    const packages = record.snapshot.packages.length;
    checks.push({ id: "data", label: "Event data stored", state: "ok", detail: `${String(packages)} published package${packages === 1 ? "" : "s"} checked.` });
  }

  if (record !== null) {
    checks.push(
      hasOfflineBasemap(record)
        ? { id: "basemap", label: "Offline background map", state: "ok", detail: "The stored packages contain an offline map." }
        : {
            id: "basemap",
            label: "Offline background map",
            state: "warning",
            detail: "No offline map in the stored packages. Drawings and positions appear on a blank background.",
          },
    );
  }

  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  checks.push(
    persisted === true
      ? { id: "storage", label: "Storage kept by the browser", state: "ok", detail: "The browser agreed not to clear this data under storage pressure." }
      : {
          id: "storage",
          label: "Storage kept by the browser",
          state: "warning",
          detail: "The browser may clear offline data when space runs low. Check again shortly before the event.",
        },
  );

  checks.push(
    window.isSecureContext && "serial" in navigator
      ? { id: "serial", label: "USB radio support", state: "ok", detail: "This browser can connect a radio over USB (Web Serial)." }
      : {
          id: "serial",
          label: "USB radio support",
          state: "error",
          detail: "This browser cannot connect USB radios. Use a current Chrome or Edge on Windows or Linux over HTTPS.",
        },
  );
  return checks;
}
