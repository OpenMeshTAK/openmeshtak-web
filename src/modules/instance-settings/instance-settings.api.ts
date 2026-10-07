import { readonly, ref } from "vue";
import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type InstanceSettingsDto = Schemas["InstanceSettingsDto"];

const DEFAULT_NAME = "OpenMeshTak";
const name = ref(DEFAULT_NAME);
let loaded: Promise<InstanceSettingsDto> | null = null;

/**
 * The installation's name for the page title and the sign-in page. Loaded once per page load;
 * until then, and if Core is unreachable, the default name stays.
 */
export const instanceName = readonly(name);

export function loadInstanceSettings(): Promise<InstanceSettingsDto> {
  loaded ??= unwrap(api.GET("/instance")).then(
    (settings) => {
      name.value = settings.name;
      return settings;
    },
    (error: unknown) => {
      // Let the next caller retry instead of keeping the failure for the whole page load.
      loaded = null;
      throw error;
    },
  );
  return loaded;
}

export async function saveInstanceSettings(version: number, newName: string): Promise<InstanceSettingsDto> {
  const saved = await unwrap(api.PUT("/instance", { body: { version, name: newName } }));
  loaded = Promise.resolve(saved);
  name.value = saved.name;
  return saved;
}
