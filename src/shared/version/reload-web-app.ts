import { logger } from "@/shared/logging/logger";

function waitForActivation(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        finish();
      }
    };
    // A failed installation must not leave the reload button stuck forever.
    const timeout = setTimeout(finish, 10_000);
    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

/** Reload only after the updated shell can serve navigation; keep offline event storage intact. */
export async function reloadWebApp(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration !== undefined) {
        await registration.update();
        const worker = registration.installing ?? registration.waiting;
        if (worker !== null) {
          await waitForActivation(worker);
        }
      }
    }
  } catch (error: unknown) {
    logger.debug("Could not update the Web app shell before reload", { error });
  }
  window.location.reload();
}
