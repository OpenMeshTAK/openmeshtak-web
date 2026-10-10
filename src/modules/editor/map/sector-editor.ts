import Feature from "ol/Feature";
import type OlMap from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import Point from "ol/geom/Point";
import { primaryAction } from "ol/events/condition";
import { Modify } from "ol/interaction";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { fromLonLat, getPointResolution } from "ol/proj";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import type { PackageObjectStyle } from "@/modules/data-packages/data-packages.api";

type Sector = NonNullable<PackageObjectStyle["sector"]>;
export type SectorHandle = "radius" | "sweep" | "rotation";
type PointerEventTarget = { on(types: string[], listener: (event: MapBrowserEvent<PointerEvent>) => void): unknown };

/** Handles in map coordinates: radius on the heading, sweep at one edge, rotation beyond the arc. */
export function sectorHandles(centre: number[], sector: Sector): Array<{ handle: SectorHandle; position: number[] }> {
  const scale = getPointResolution("EPSG:3857", 1, centre, "m");
  const at = (distance: number, bearing: number) => {
    const angle = bearing * Math.PI / 180;
    return [(centre[0] ?? 0) + Math.sin(angle) * distance / scale, (centre[1] ?? 0) + Math.cos(angle) * distance / scale];
  };
  return [
    { handle: "radius", position: at(sector.radius, sector.heading) },
    { handle: "sweep", position: at(sector.radius, sector.heading + sector.sweep / 2) },
    { handle: "rotation", position: at(sector.radius * 1.3, sector.heading) },
  ];
}

/** Applies a dragged handle within the API limits; Shift snaps heading and sweep to 15°. */
export function sectorFromHandle(centre: number[], sector: Sector, handle: SectorHandle, position: number[], snap = false): Sector {
  const x = (position[0] ?? 0) - (centre[0] ?? 0);
  const y = (position[1] ?? 0) - (centre[1] ?? 0);
  const bearing = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
  const round = (value: number) => snap ? Math.round(value / 15) * 15 : Math.round(value * 10) / 10;
  if (handle === "rotation") return { ...sector, heading: round(bearing) % 360 };
  if (handle === "sweep") {
    const offset = Math.abs(((bearing - sector.heading + 540) % 360) - 180);
    return { ...sector, sweep: Math.min(360, Math.max(1, round(offset * 2))) };
  }
  const metres = Math.hypot(x, y) * getPointResolution("EPSG:3857", 1, centre, "m");
  return { ...sector, radius: Math.min(100_000, Math.max(0.1, Math.round(metres))) };
}

/** Parametric sector handles, styled like the ellipse editor's. The centre moves with the point. */
export class SectorEditor {
  private readonly source = new VectorSource<Feature<Point>>();
  private readonly modify: Modify;
  private target: { id: string; centre: number[]; style: PackageObjectStyle } | null = null;
  private edited: Sector | null = null;
  private active = true;
  private shiftHeld = false;
  private repositioning = false;

  constructor(map: OlMap, preview: (style: PackageObjectStyle) => void, commit: (id: string, style: PackageObjectStyle) => void) {
    (map as unknown as PointerEventTarget).on(["pointerdown", "pointerdrag", "pointerup"], (event) => { this.shiftHeld = event.originalEvent.shiftKey; });
    map.addLayer(new VectorLayer({ source: this.source, style: (feature) => new Style({
      image: new Circle({ radius: 6, fill: new Fill({ color: "#FFFFFF" }), stroke: new Stroke({ color: "#1565C0", width: 2 }) }),
      text: new Text({ text: String(feature.get("handle")), offsetY: -15, fill: new Fill({ color: "#1565C0" }), stroke: new Stroke({ color: "#FFFFFF", width: 3 }) }),
    }) }));
    this.modify = new Modify({ source: this.source, pixelTolerance: 8, condition: primaryAction, insertVertexCondition: () => false, deleteCondition: () => false });
    this.modify.on("modifyend", () => {
      if (this.target !== null && this.edited !== null) commit(this.target.id, { ...this.target.style, sector: this.edited });
      this.edited = null;
    });
    this.source.on("changefeature", (event) => {
      const position = event.feature?.getGeometry()?.getCoordinates();
      const sector = this.target?.style.sector;
      if (this.repositioning || this.target === null || sector == null || position === undefined || event.feature === undefined) return;
      const dragged = event.feature.get("handle") as SectorHandle;
      const edited = sectorFromHandle(this.target.centre, sector, dragged, position, this.shiftHeld);
      this.edited = edited;
      preview({ ...this.target.style, sector: edited });
      // The other handles follow live; moving them must not count as another drag.
      this.repositioning = true;
      for (const { handle, position: at } of sectorHandles(this.target.centre, edited)) {
        const feature = this.source.getFeatures().find((item) => item.get("handle") === handle);
        if (handle !== dragged) feature?.getGeometry()?.setCoordinates(at);
      }
      this.repositioning = false;
    });
    map.addInteraction(this.modify);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.modify.setActive(active);
    if (!active) this.source.clear();
  }

  /** `position` is the point's WGS84 position. */
  show(id: string | null, position: number[] | undefined, style: PackageObjectStyle | undefined, editable: boolean): void {
    this.source.clear();
    this.edited = null;
    this.target = id !== null && position !== undefined && style?.sector != null && editable ? { id, centre: fromLonLat(position.slice(0, 2)), style } : null;
    if (!this.active || this.target === null || this.target.style.sector == null) return;
    this.source.addFeatures(sectorHandles(this.target.centre, this.target.style.sector).map(({ handle, position: at }) => new Feature({ geometry: new Point(at), handle })));
  }
}
