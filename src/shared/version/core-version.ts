import { reactive, readonly } from "vue";
import { api } from "@/shared/api/client";
import { logger } from "@/shared/logging/logger";
import { isCompatibleCoreVersion } from "./version-compatibility";

export const WEB_VERSION = __APP_VERSION__;

const state = reactive<{ incompatible: string | null; updatedTo: string | null }>({ incompatible: null, updatedTo: null });
let firstSeen: string | null = null;

/**
 * What the version bar shows: `incompatible` when this Web app does not fit the server at all,
 * `updatedTo` when the server was updated while this page stayed open and a reload brings the
 * matching Web app.
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
      state.updatedTo = data.version;
    } else if (!isCompatibleCoreVersion(WEB_VERSION, data.version)) {
      state.incompatible = data.version;
    }
  } catch (error: unknown) {
    // An unreachable Core shows up in every other request; the version check stays quiet.
    logger.debug("Could not read the Core version", { error });
  }
}
