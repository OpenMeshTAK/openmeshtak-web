import { MilStdAttributes, Modifiers, WebRenderer } from "@armyc2.c5isr.renderer/mil-sym-ts-web";

export interface TacticalRenderRequest { id: number; sidc: string; coordinates: number[][]; modifiers: Record<string, string>; color: string; width: number; scale: number }
export interface TacticalRenderResponse { id: number; geojson: string | null; error: string | null }
const modifierNames: Record<string, string> = { T: Modifiers.T_UNIQUE_DESIGNATION_1, T1: Modifiers.T1_UNIQUE_DESIGNATION_2,
  B: Modifiers.B_ECHELON, AS: Modifiers.AS_COUNTRY, W: Modifiers.W_DTG_1, W1: Modifiers.W1_DTG_2 };

/** Official renderer runs outside the UI thread; no network assets, HTML or SVG injection. */
export function renderTactical(request: TacticalRenderRequest): TacticalRenderResponse {
  try {
    const attributes = new Map([[MilStdAttributes.LineColor, request.color], [MilStdAttributes.LineWidth, String(request.width)]]);
    const modifiers = new Map(Object.entries(request.modifiers).map(([key, value]) => [modifierNames[key] ?? key, value]));
    const geojson = WebRenderer.RenderSymbol(String(request.id), "", "", request.sidc,
      request.coordinates.map((point) => point.slice(0, 2).join(",")).join(" "), "clampToGround", request.scale, "", modifiers, attributes, WebRenderer.OUTPUT_FORMAT_GEOJSON);
    if (geojson.length > 2_000_000) throw new Error("The rendered graphic exceeds the display limit.");
    const parsed = JSON.parse(geojson) as { type?: string };
    if (parsed.type !== "FeatureCollection") throw new Error("The renderer could not draw these control points.");
    return { id: request.id, geojson, error: null };
  } catch { return { id: request.id, geojson: null, error: "Tactical rendering unavailable; editable control geometry is shown." }; }
}

if (typeof self !== "undefined" && typeof document === "undefined") self.onmessage = (event: MessageEvent<TacticalRenderRequest>) => self.postMessage(renderTactical(event.data));
