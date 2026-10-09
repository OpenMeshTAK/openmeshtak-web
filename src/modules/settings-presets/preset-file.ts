import { saveFile } from "@/shared/files/save-file";
import type { PresetDocumentDto, PresetKind } from "./settings-presets.api";

/** Matches Core's limit, so a too large file is refused before it is uploaded. */
export const MAX_PRESET_FILE_BYTES = 512 * 1024;

export const KIND_LABELS: Record<PresetKind, string> = { meshtastic: "Meshtastic", tak: "TAK" };

/**
 * Reads a preset file as JSON. Only the outer shape is checked here so the operator gets a clear
 * message for the wrong file; Core validates every field before anything changes.
 */
export async function readPresetFile(file: File, kind: PresetKind): Promise<PresetDocumentDto> {
  if (file.size > MAX_PRESET_FILE_BYTES) {
    throw new Error("The file is larger than 512 KB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("The file is not valid JSON. Choose an OpenMeshTak preset (.json).");
  }
  if (typeof parsed !== "object" || parsed === null || (parsed as { format?: unknown }).format !== "openmeshtak-preset") {
    throw new Error("This is not an OpenMeshTak preset.");
  }
  const fileKind = (parsed as { kind?: unknown }).kind;
  if (fileKind !== "tak" && fileKind !== "meshtastic") {
    throw new Error("This preset has no supported kind.");
  }
  if (fileKind !== kind) {
    throw new Error(`This is a ${KIND_LABELS[fileKind]} preset. Import it in the event's ${KIND_LABELS[fileKind]} settings.`);
  }
  return parsed as PresetDocumentDto;
}

function fileNameOf(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${slug === "" ? "preset" : slug}.openmeshtak-preset.json`;
}

export function downloadPreset(document: PresetDocumentDto): void {
  saveFile(new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: "application/json" }), fileNameOf(document.name));
}
