import { computed, shallowRef } from "vue";
import { isApiProblem } from "@/shared/errors/api-problem";
import { listDataPackages } from "@/modules/data-packages/data-packages.api";
import { topFirst } from "@/modules/data-packages/package-order";
import { mapContentItems } from "@/modules/editor/map/map-content";
import { usePackageEditor, type PackageEditor } from "@/modules/editor/usePackageEditor";

/**
 * The event's Data Packages as read-only map context for the live view and the history, drawn in
 * the same order as the event editor. Without `data-packages.read` the map simply has no packages.
 */
export function useEventMapContent(eventId: string) {
  const editors = shallowRef<PackageEditor[]>([]);

  const ordered = computed(() => {
    const loaded = editors.value.flatMap((editor) => (editor.dataPackage.value === null ? [] : [{ editor, dataPackage: editor.dataPackage.value }]));
    const order = topFirst(loaded.map(({ dataPackage }) => dataPackage)).map(({ id }) => id);
    return loaded.sort((a, b) => order.indexOf(a.dataPackage.id) - order.indexOf(b.dataPackage.id));
  });
  /** Same drawing order as the event editor: the top package of the list is drawn last. */
  const layers = computed(() =>
    [...ordered.value]
      .reverse()
      .flatMap(({ editor }) => editor.sortedLayers.value)
      .map((layer, sortOrder) => ({ ...layer, sortOrder })),
  );
  const objects = computed(() => ordered.value.flatMap(({ editor }) => editor.objects.value));
  const contents = computed(() => editors.value.flatMap((editor) => mapContentItems(editor.path, editor.contents.value)));

  async function load(): Promise<void> {
    try {
      const packages = await listDataPackages(eventId);
      const loaded = await Promise.all(
        packages.map(async ({ id }) => {
          const editor = usePackageEditor(eventId, id);
          await editor.load();
          return editor;
        }),
      );
      editors.value = loaded.filter(({ loadState }) => loadState.value !== "error");
    } catch (caught: unknown) {
      if (!isApiProblem(caught, "FORBIDDEN")) {
        throw caught;
      }
    }
  }

  return { layers, objects, contents, load };
}
