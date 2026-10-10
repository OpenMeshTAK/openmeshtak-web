import { reactive, readonly } from "vue";
import { api } from "@/shared/api/client";
import { useToast } from "@/shared/feedback/toast";
import { logger } from "@/shared/logging/logger";
import { isCompatibleCoreVersion } from "./version-compatibility";
import { reloadWebApp } from "./reload-web-app";

export const WEB_VERSION = __APP_VERSION__;

const state = reactive<{ incompatible: string | null; updatedTo: string | null }>({ incompatible: null, updatedTo: null });
let firstSeen: string | null = null;

/**
 * What the version bar shows: `incompatible` when this Web app does not fit the server at all,
 * `updatedTo` when the server was updated while this page stayed open; that one is shown as a
 * lasting toast with a reload button.
 */
export const coreVersion = readonly(state);

/** Reads Core's version; called at start and again whenever the live connection comes back. */
export async function checkCoreVersion(): Promise<void> {
  try {
    const { data } = await api.GET("/health");
    if (data === undefined) {
      return;
    }
    firstSeen ??= data.version;
    if (data.version !== firstSeen) {
      if (state.updatedTo !== data.version) {
        state.updatedTo = data.version;
        // Stays on screen: the page keeps working, but only a reload brings the matching Web app.
        useToast().lasting("info", `OpenMeshTak was updated to ${data.version}. Reload to use the new version.`, {
          label: "Reload",
          run: () => void reloadWebApp(),
        });
      }
    }
    state.incompatible = isCompatibleCoreVersion(WEB_VERSION, data.version) ? null : data.version;
  } catch (error: unknown) {
    // An unreachable Core shows up in every other request; the version check stays quiet.
    logger.debug("Could not read the Core version", { error });
  }
}
