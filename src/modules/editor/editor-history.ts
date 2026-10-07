import { computed, ref, toRaw } from "vue";

let historySequence = 0;

export interface EditorHistoryAction {
  label: string;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  /** The objects and layers the step changes, as stable handles; see `dropTouching`. */
  touches?: readonly object[];
}

interface HistoryEntry extends EditorHistoryAction {
  sequence: number;
}

/** In-memory history for one package; sequence numbers make histories comparable in the event editor. */
export function useEditorHistory() {
  const undoStack = ref<HistoryEntry[]>([]);
  const redoStack = ref<HistoryEntry[]>([]);
  const busy = ref(false);
  const canUndo = computed(() => undoStack.value.length > 0 && !busy.value);
  const canRedo = computed(() => redoStack.value.length > 0 && !busy.value);
  const undoLabel = computed(() => undoStack.value.at(-1)?.label ?? null);
  const redoLabel = computed(() => redoStack.value.at(-1)?.label ?? null);
  const undoSequence = computed(() => undoStack.value.at(-1)?.sequence ?? -1);
  const redoSequence = computed(() => redoStack.value.at(-1)?.sequence ?? -1);

  function record(action: EditorHistoryAction): void {
    undoStack.value = [...undoStack.value, { ...action, sequence: ++historySequence }];
    redoStack.value = [];
  }

  function clear(): void {
    undoStack.value = [];
    redoStack.value = [];
  }

  /**
   * Forgets the steps that change any of `handles`, e.g. because someone else just changed that
   * object: undoing them would overwrite the other person's work. Steps for other objects stay.
   * Returns how many steps were dropped.
   */
  function dropTouching(handles: ReadonlySet<object>): number {
    // The stacks are reactive, so stored handles come back as proxies of the original objects.
    const keep = (entry: HistoryEntry) => !(entry.touches ?? []).some((handle) => handles.has(toRaw(handle)));
    const before = undoStack.value.length + redoStack.value.length;
    undoStack.value = undoStack.value.filter(keep);
    redoStack.value = redoStack.value.filter(keep);
    return before - undoStack.value.length - redoStack.value.length;
  }

  async function move(from: "undo" | "redo"): Promise<void> {
    const source = from === "undo" ? undoStack : redoStack;
    const target = from === "undo" ? redoStack : undoStack;
    const entry = source.value.at(-1);
    if (entry === undefined || busy.value) {
      return;
    }
    busy.value = true;
    try {
      const succeeded = await (from === "undo" ? entry.undo() : entry.redo());
      if (succeeded) {
        source.value = source.value.slice(0, -1);
        target.value = [...target.value, { ...entry, sequence: ++historySequence }];
      }
    } finally {
      busy.value = false;
    }
  }

  return {
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    undoSequence,
    redoSequence,
    record,
    clear,
    dropTouching,
    undo: () => move("undo"),
    redo: () => move("redo"),
  };
}
