import { forward } from "mgrs";
import proj4 from "proj4";
import Feature from "ol/Feature";
import type OlMap from "ol/Map";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { fromLonLat, getPointResolution, toLonLat, transformExtent } from "ol/proj";
import { Fill, Stroke, Style, Text } from "ol/style";
import Control from "ol/control/Control";

/** Zone boundaries, 100 km squares, then finer lines, like ATAK's MGRS grid. */
export type GridLevel = "zone" | "square" | "line";
export interface GridLine { level: GridLevel; positions: number[][] }
export interface GridLabel { level: GridLevel; position: number[]; text: string; anchor: "centre" | "bottom" | "left" }

const BANDS = "CDEFGHJKLMNPQRSTUVWX";
const MIN_LATITUDE = -80;
const MAX_LATITUDE = 84;
/** Lines closer than this on screen would turn into noise. */
const MIN_LINE_PIXELS = 70;
const MAX_LINES = 400;

export const GRID_SPACINGS = [100_000, 10_000, 1_000, 100] as const;
export type GridSpacing = (typeof GRID_SPACINGS)[number];
export interface GridSettings { spacing: "auto" | GridSpacing; tone: "dark" | "light"; width: "thin" | "normal" | "thick"; labels: boolean }
export const DEFAULT_GRID_SETTINGS: GridSettings = { spacing: "auto", tone: "dark", width: "normal", labels: true };
const WIDTH_FACTORS: Record<GridSettings["width"], number> = { thin: 0.7, normal: 1, thick: 1.8 };
/** A fixed spacing still gives way to zones only when its lines would merge on screen. */
const MIN_FIXED_PIXELS = 12;

/** Finest of 100 km / 10 km / 1 km / 100 m that keeps lines readable; `null` shows zones only. */
export function gridSpacing(metresPerPixel: number, chosen: GridSettings["spacing"] = "auto"): number | null {
  if (chosen !== "auto") return chosen / metresPerPixel >= MIN_FIXED_PIXELS ? chosen : null;
  return [100, 1_000, 10_000, 100_000].find((spacing) => spacing / metresPerPixel >= MIN_LINE_PIXELS) ?? null;
}

function utm(zone: number, south: boolean): string {
  return `+proj=utm +zone=${String(zone)}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
}

/** Splits sampled positions into runs inside the zone cell, so lines stop at zone edges. */
function runs(positions: number[][], inside: (position: number[]) => boolean): number[][][] {
  const result: number[][][] = [];
  let current: number[][] = [];
  for (const position of positions) {
    if (inside(position)) current.push(position);
    else if (current.length > 0) { if (current.length > 1) result.push(current); current = []; }
  }
  if (current.length > 1) result.push(current);
  return result;
}

/** Digits shown on a line: kilometres within the 100 km square, or hectometres at 100 m spacing. */
function lineDigits(value: number, spacing: number): string {
  const within = ((value % 100_000) + 100_000) % 100_000;
  return spacing === 100 ? String(Math.round(within / 100)).padStart(3, "0") : String(Math.round(within / 1_000)).padStart(2, "0");
}

/**
 * Grid geometry for a WGS84 view extent [west, south, east, north]. Pure, so it can be tested and
 * recomputed on every view change. The Norway/Svalbard zone exceptions are not drawn.
 */
export function mgrsGrid(extent: number[], metresPerPixel: number, chosen: GridSettings["spacing"] = "auto"): { lines: GridLine[]; labels: GridLabel[] } {
  const west = Math.max(-180, extent[0] ?? -180);
  const east = Math.min(180, extent[2] ?? 180);
  const south = Math.max(MIN_LATITUDE, extent[1] ?? MIN_LATITUDE);
  const north = Math.min(MAX_LATITUDE, extent[3] ?? MAX_LATITUDE);
  const lines: GridLine[] = [];
  const labels: GridLabel[] = [];
  if (west >= east || south >= north) return { lines, labels };

  // Grid zone designators: 6° zones and 8° latitude bands (X spans 72–84°).
  for (let longitude = Math.ceil((west + 180) / 6) * 6 - 180; longitude <= east; longitude += 6) {
    lines.push({ level: "zone", positions: [[longitude, south], [longitude, north]] });
  }
  for (let latitude = MIN_LATITUDE; latitude < MAX_LATITUDE; latitude += 8) {
    if (latitude > south && latitude < north) lines.push({ level: "zone", positions: [[west, latitude], [east, latitude]] });
  }
  const firstZone = Math.floor((west + 180) / 6) + 1;
  const lastZone = Math.min(60, Math.floor((east + 180) / 6) + 1);
  const spacing = gridSpacing(metresPerPixel, chosen);
  if (spacing === null || lastZone - firstZone > 3) {
    for (let zone = firstZone; zone <= lastZone; zone++) {
      for (let band = 0; band < BANDS.length; band++) {
        const bandSouth = MIN_LATITUDE + band * 8;
        const bandNorth = band === BANDS.length - 1 ? MAX_LATITUDE : bandSouth + 8;
        const longitude = Math.min(Math.max(zone * 6 - 183, west), east);
        const latitude = (Math.max(bandSouth, south) + Math.min(bandNorth, north)) / 2;
        if (bandNorth > south && bandSouth < north && labels.length < 200) labels.push({ level: "zone", position: [longitude, latitude], text: `${String(zone)}${BANDS[band] ?? ""}`, anchor: "centre" });
      }
    }
    return { lines, labels };
  }

  for (let zone = firstZone; zone <= lastZone; zone++) {
    const zoneWest = zone * 6 - 186;
    const zoneEast = zoneWest + 6;
    for (const southern of [true, false]) {
      const cell = [Math.max(west, zoneWest), Math.max(south, southern ? MIN_LATITUDE : 0), Math.min(east, zoneEast), Math.min(north, southern ? 0 : MAX_LATITUDE)];
      if ((cell[0] ?? 0) >= (cell[2] ?? 0) || (cell[1] ?? 0) >= (cell[3] ?? 0)) continue;
      const projection = proj4("WGS84", utm(zone, southern));
      const inside = ([longitude = 0, latitude = 0]: number[]) => longitude >= (cell[0] ?? 0) - 1e-9 && longitude <= (cell[2] ?? 0) + 1e-9 && latitude >= (cell[1] ?? 0) - 1e-9 && latitude <= (cell[3] ?? 0) + 1e-9;
      // The cell's UTM bounds from samples along its edges (zone edges curve in UTM).
      const samples: number[][] = [];
      for (let step = 0; step <= 8; step++) {
        const t = step / 8;
        const longitude = (cell[0] ?? 0) + ((cell[2] ?? 0) - (cell[0] ?? 0)) * t;
        const latitude = (cell[1] ?? 0) + ((cell[3] ?? 0) - (cell[1] ?? 0)) * t;
        samples.push(projection.forward([longitude, cell[1] ?? 0]), projection.forward([longitude, cell[3] ?? 0]), projection.forward([cell[0] ?? 0, latitude]), projection.forward([cell[2] ?? 0, latitude]));
      }
      const eastings = samples.map((p) => p[0] ?? 0);
      const northings = samples.map((p) => p[1] ?? 0);
      const [eMin, eMax, nMin, nMax] = [Math.min(...eastings), Math.max(...eastings), Math.min(...northings), Math.max(...northings)];
      const level: GridLevel = spacing === 100_000 ? "square" : "line";
      const along = (from: number, to: number) => Array.from({ length: 25 }, (_, index) => from + (to - from) * index / 24);
      for (let easting = Math.ceil(eMin / spacing) * spacing; easting <= eMax && lines.length < MAX_LINES; easting += spacing) {
        for (const run of runs(along(nMin, nMax).map((northing) => projection.inverse([easting, northing])), inside)) {
          lines.push({ level: easting % 100_000 === 0 ? "square" : level, positions: run });
          if (spacing < 100_000) labels.push({ level, position: run[0] ?? [], text: lineDigits(easting, spacing), anchor: "bottom" });
        }
      }
      for (let northing = Math.ceil(nMin / spacing) * spacing; northing <= nMax && lines.length < MAX_LINES; northing += spacing) {
        for (const run of runs(along(eMin, eMax).map((easting) => projection.inverse([easting, northing])), inside)) {
          lines.push({ level: northing % 100_000 === 0 ? "square" : level, positions: run });
          if (spacing < 100_000) labels.push({ level, position: run[0] ?? [], text: lineDigits(northing, spacing), anchor: "left" });
        }
      }
      // 100 km square identifiers, e.g. "32U NE", only while whole squares are in view; when zoomed
      // in, the layer shows the square under the view centre beside the scale bar instead.
      if (spacing === 100_000) for (let easting = Math.floor(eMin / 100_000) * 100_000; easting <= eMax && labels.length < 300; easting += 100_000) {
        for (let northing = Math.floor(nMin / 100_000) * 100_000; northing <= nMax && labels.length < 300; northing += 100_000) {
          // The visible part of the square, so its name stays on screen when zoomed in.
          const centre = projection.inverse([(Math.max(easting, eMin) + Math.min(easting + 100_000, eMax)) / 2, (Math.max(northing, nMin) + Math.min(northing + 100_000, nMax)) / 2]);
          if (!inside(centre)) continue;
          try {
            const reference = forward(centre as [number, number], 0);
            labels.push({ level: "square", position: centre, text: `${reference.slice(0, -2)} ${reference.slice(-2)}`, anchor: "centre" });
          } catch {
            // Outside MGRS coverage; leave the square unlabeled.
          }
        }
      }
    }
  }
  return { lines, labels };
}

function lineStyles(level: GridLevel, tone: GridSettings["tone"], factor: number): Style[] {
  const ink = tone === "dark" ? "20, 20, 20" : "255, 255, 255";
  const halo = tone === "dark" ? "255, 255, 255" : "20, 20, 20";
  if (level === "line") return [new Style({ stroke: new Stroke({ color: `rgba(${ink}, 0.6)`, width: 0.75 * factor }) })];
  const width = (level === "zone" ? 2 : 1.25) * factor;
  return [new Style({ stroke: new Stroke({ color: `rgba(${halo}, 0.7)`, width: width + 2 }) }), new Style({ stroke: new Stroke({ color: `rgba(${ink}, 0.9)`, width }) })];
}

function labelStyle(label: GridLabel, tone: GridSettings["tone"]): Style {
  return new Style({ text: new Text({
    text: label.text,
    font: `${label.level === "line" ? "500 11px" : "600 12px"} Roboto, Arial, sans-serif`,
    fill: new Fill({ color: tone === "dark" ? "#141414" : "#FFFFFF" }),
    stroke: new Stroke({ color: tone === "dark" ? "#FFFFFF" : "#141414", width: 3 }),
    textAlign: label.anchor === "left" ? "left" : "center",
    textBaseline: label.anchor === "bottom" ? "bottom" : "middle",
    offsetX: label.anchor === "left" ? 4 : 0,
    offsetY: label.anchor === "bottom" ? -4 : 0,
  }) });
}

/** An optional MGRS/UTM overlay that follows the view while panning and zooming. */
export class MgrsGridLayer {
  private readonly source = new VectorSource();
  readonly layer = new VectorLayer({ source: this.source, visible: false, updateWhileInteracting: true, updateWhileAnimating: true });
  private settings: GridSettings = DEFAULT_GRID_SETTINGS;
  private frame: number | null = null;
  private readonly square = document.createElement("div");

  constructor(private readonly map: OlMap) {
    this.square.className = "editor-grid-square";
    this.square.hidden = true;
    map.addControl(new Control({ element: this.square }));
    // Recompute at most once per frame while the view moves, not only when the gesture ends.
    const schedule = () => {
      if (!this.layer.getVisible() || this.frame !== null) return;
      this.frame = requestAnimationFrame(() => { this.frame = null; this.update(); });
    };
    map.getView().on(["change:center", "change:resolution", "change:rotation"], schedule);
    map.on("change:size", schedule);
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
    if (visible) this.update();
    else { this.source.clear(); this.square.hidden = true; }
  }

  setSettings(settings: GridSettings): void {
    this.settings = settings;
    if (this.layer.getVisible()) this.update();
  }

  private update(): void {
    const view = this.map.getView();
    const size = this.map.getSize();
    const resolution = view.getResolution();
    if (size === undefined || resolution === undefined) return;
    const extent = transformExtent(view.calculateExtent(size), view.getProjection(), "EPSG:4326");
    const metresPerPixel = getPointResolution(view.getProjection(), resolution, view.getCenter() ?? [0, 0], "m");
    const { lines, labels } = mgrsGrid(extent, metresPerPixel, this.settings.spacing);
    const tone = this.settings.tone;
    const factor = WIDTH_FACTORS[this.settings.width];
    const styles = { zone: lineStyles("zone", tone, factor), square: lineStyles("square", tone, factor), line: lineStyles("line", tone, factor) };
    const spacing = gridSpacing(metresPerPixel, this.settings.spacing);
    let square: string | null = null;
    if (spacing !== null && spacing < 100_000) {
      try {
        const reference = forward(toLonLat(view.getCenter() ?? [0, 0]) as [number, number], 0);
        square = `${reference.slice(0, -2)} ${reference.slice(-2)}`;
      } catch {
        square = null;
      }
    }
    this.square.hidden = square === null;
    this.square.textContent = square ?? "";
    this.source.clear(true);
    this.source.addFeatures([
      ...lines.map((line) => { const feature = new Feature(new LineString(line.positions.map((p) => fromLonLat(p)))); feature.setStyle(styles[line.level]); return feature; }),
      ...(this.settings.labels ? labels : []).map((label) => { const feature = new Feature(new Point(fromLonLat(label.position))); feature.setStyle(labelStyle(label, tone)); return feature; }),
    ]);
  }
}
