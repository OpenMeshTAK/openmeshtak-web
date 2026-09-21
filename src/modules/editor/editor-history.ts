import { computed, ref } from "vue";

let historySequence = 0;

export interface EditorHistoryAction {
  label: string;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
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
    undo: () => move("undo"),
    redo: () => move("redo"),
  };
}
