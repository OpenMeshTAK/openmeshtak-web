import type { BaseMapLayer } from "./map-settings.api";

export type BaseMapPreset = "street" | "satellite" | "custom";
/** Operator-selected templates, never automatically added to an existing installation. */
export function newBaseMapLayer(preset: BaseMapPreset): BaseMapLayer {
  const id = crypto.randomUUID();
  if (preset === "street") return {
    id, providerName: "OpenStreetMap", tileUrlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors", maxZoom: 19,
  };
  // Endpoint and source attribution from Esri's World Imagery service directory:
  // https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
  if (preset === "satellite") return {
    id, providerName: "Satellite · Esri World Imagery",
    tileUrlTemplate: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community", maxZoom: 22,
  };
  return { id, providerName: "", tileUrlTemplate: "", attribution: "", maxZoom: 19 };
}
