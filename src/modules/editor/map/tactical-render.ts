import type Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import LineString from "ol/geom/LineString";
import Polygon from "ol/geom/Polygon";
import type Geometry from "ol/geom/Geometry";
import { toLonLat } from "ol/proj";
import { Fill, Stroke, Style, Text } from "ol/style";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";
import type { TacticalRenderResponse } from "./tactical-render.worker";

const format = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
let worker: Worker | null = null;
let workerFailed = false;
let sequence = 0;
const pending = new Map<number, { feature: Feature; key: string; labelled: boolean; color: string }>();
const cache = new WeakMap<Feature, { key: string; styles: Style[] | null }>();
const geometryIds = new WeakMap<Geometry, number>();
let geometrySequence = 0;

function parseStyles(geojson: string, labelled: boolean, color: string): Style[] {
  return format.readFeatures(geojson).map((part) => {
    const label = part.get("label") as unknown;
    return new Style({ geometry: part.getGeometry()!, stroke: new Stroke({ color, width: Number(part.get("strokeWidth") ?? 3) }),
      fill: new Fill({ color: `${color}33` }),
      ...(labelled && typeof label === "string" && label !== "" ? { text: new Text({ text: label, font: "bold 12px Arial, sans-serif", fill: new Fill({ color }),
        stroke: new Stroke({ color: "#FFFFFF", width: 3 }), rotation: Number(part.get("rotation") ?? 0) * Math.PI / 180, overflow: true }) } : {}),
    });
  });
}

/** Lazy worker; cached by live control geometry and quantized rendering scale. */
export function tacticalStyles(feature: Feature, style: PackageObjectStyle, resolution: number, labelled: boolean): Style[] | null {
  if (style.tacticalGraphic == null || typeof Worker === "undefined") return null;
  if (workerFailed) { feature.set("tacticalRenderError", "Tactical renderer unavailable; control geometry is shown."); return null; }
  const geometry = feature.getGeometry();
  if (!(geometry instanceof LineString) && !(geometry instanceof Polygon)) return null;
  const scale = 500 * 1.25 ** Math.round(Math.log(Math.max(1, resolution)) / Math.log(1.25));
  if (!geometryIds.has(geometry)) geometryIds.set(geometry, ++geometrySequence);
  const key = `${geometryIds.get(geometry)}:${geometry.getRevision()}:${JSON.stringify(style)}:${scale}:${labelled}`;
  const cached = cache.get(feature);
  if (cached?.key === key) return cached.styles;
  if (worker === null) {
    worker = new Worker(new URL("./tactical-render.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<TacticalRenderResponse>) => {
      const job = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (job === undefined || cache.get(job.feature)?.key !== job.key) return;
      let styles: Style[] | null = null;
      try { if (event.data.geojson !== null) styles = parseStyles(event.data.geojson, job.labelled, job.color); }
      catch { /* Keep source control geometry if renderer output cannot be decoded. */ }
      cache.set(job.feature, { key: job.key, styles });
      job.feature.set("tacticalRenderError", styles === null ? event.data.error ?? "Tactical renderer unavailable; control geometry is shown." : null);
      job.feature.changed();
    };
    worker.onerror = () => {
      workerFailed = true;
      worker?.terminate();
      for (const job of pending.values()) { job.feature.set("tacticalRenderError", "Tactical renderer unavailable; control geometry is shown."); job.feature.changed(); }
      pending.clear();
    };
  }
  // Obsolete responses are ignored and retained jobs are bounded.
  for (const [id, job] of pending) if (job.feature === feature) pending.delete(id);
  if (pending.size >= 128) return null;
  cache.set(feature, { key, styles: null });
  const id = ++sequence;
  pending.set(id, { feature, key, labelled, color: style.color });
  const points = geometry instanceof Polygon ? geometry.getCoordinates()[0] ?? [] : geometry.getCoordinates();
  try {
    // Vue styles can be reactive proxies. Construct a plain payload before structured cloning.
    worker.postMessage({ id, sidc: style.tacticalGraphic.sidc, coordinates: points.map((point) => toLonLat(point)),
      modifiers: Object.fromEntries(Object.entries(style.tacticalGraphic.modifiers)), color: style.color, width: style.strokeWidth, scale });
  } catch {
    pending.delete(id);
    feature.set("tacticalRenderError", "Tactical renderer unavailable; control geometry is shown.");
    feature.changed();
  }
  return null;
}
