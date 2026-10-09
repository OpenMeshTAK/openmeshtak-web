import { ref, watch, type Ref } from "vue";
import type { PackageContentDto } from "@/modules/data-packages/data-packages.api";
import { instanceIconUrl, loadInstanceIcons } from "@/modules/icon-settings/icon-settings.api";
import { describeError } from "@/shared/errors/api-problem";
import { iconImageUrl, iconLibraries, listLibraryIcons, type PackageIcon, type PackagePath } from "./icon-libraries.api";

export type IconChoice = PackageIcon & { imageUrl: string };

/**
 * Icons a marker can use: the shared instance icon sets plus the package's own icon libraries.
 * A package library wins over a shared icon with the same path; a failed source leaves the others usable.
 */
export function useIconSets(path: Ref<PackagePath | null>, contents: Ref<readonly PackageContentDto[]>) {
  const icons = ref<IconChoice[]>([]);
  const loading = ref(false);
  const error = ref("");
  let generation = 0;

  async function load(): Promise<void> {
    const currentGeneration = ++generation;
    const packagePath = path.value;
    loading.value = true;
    error.value = "";
    const libraries = packagePath === null ? [] : iconLibraries(packagePath, contents.value);
    const results = await Promise.allSettled([
      loadInstanceIcons().then((catalogue) => catalogue.icons.map((icon) => ({ ...icon, imageUrl: instanceIconUrl(catalogue.version, icon.id) }))),
      ...libraries.map(async (library) => (await listLibraryIcons(library)).map((icon) => ({ ...icon, imageUrl: iconImageUrl(library, icon.id) }))),
    ]);
    if (currentGeneration !== generation) return;
    const available = results.flatMap((entry) => (entry.status === "fulfilled" ? entry.value : []));
    icons.value = [...new Map(available.map((icon) => [icon.path, icon])).values()];
    const failed = results.find((entry) => entry.status === "rejected");
    if (failed?.status === "rejected") error.value = describeError(failed.reason);
    loading.value = false;
  }

  watch(() => [path.value?.packageId, contents.value] as const, () => { void load(); }, { immediate: true });

  return { icons, loading, error };
}
