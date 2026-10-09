import Feature from "ol/Feature";
import type OlMap from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import Point from "ol/geom/Point";
import { primaryAction } from "ol/events/condition";
import { Modify } from "ol/interaction";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import type { PackageGeometry } from "@/modules/data-packages/data-packages.api";
import { ellipseFromHandle, ellipseHandles, ellipsePolygon, type EllipseHandle } from "./shape-editing";

type EllipseGeometry = Extract<PackageGeometry, { type: "Ellipse" }>;
type PointerEventTarget = { on(types: string[], listener: (event: MapBrowserEvent<PointerEvent>) => void): unknown };

/** Independent handles keep an ellipse parametric instead of letting Modify edit its polygon. */
export class EllipseEditor {
  private readonly source = new VectorSource<Feature<Point>>();
  private readonly modify: Modify;
  private original: EllipseGeometry | null = null;
  private objectId: string | null = null;
  private edited: EllipseGeometry | null = null;
  private active = true;
  private shiftHeld = false;

  constructor(map: OlMap, preview: (geometry: ReturnType<typeof ellipsePolygon>) => void, commit: (id: string, geometry: EllipseGeometry) => void) {
    // Map listeners run before interactions, so each preview sees the current modifier state.
    // OpenLayers dispatches pointerdown and pointerup on the map, but its typings omit them.
    (map as unknown as PointerEventTarget).on(["pointerdown", "pointerdrag", "pointerup"], (event) => { this.shiftHeld = event.originalEvent.shiftKey; });
    const nearRotationHandle = (event: MapBrowserEvent) => {
      const feature = this.source.getClosestFeatureToCoordinate(event.coordinate);
      if (feature?.get("handle") !== "rotation") return false;
      const position = feature.getGeometry()?.getCoordinates();
      if (position === undefined) return false;
      const pixel = map.getPixelFromCoordinate(position);
      return Math.hypot((pixel[0] ?? 0) - (event.pixel[0] ?? 0), (pixel[1] ?? 0) - (event.pixel[1] ?? 0)) <= 8;
    };
    map.addLayer(new VectorLayer({ source: this.source, style: (feature) => new Style({
      image: new Circle({ radius: 6, fill: new Fill({ color: "#FFFFFF" }), stroke: new Stroke({ color: "#1565C0", width: 2 }) }),
      text: new Text({ text: String(feature.get("handle")), offsetY: -15, fill: new Fill({ color: "#1565C0" }), stroke: new Stroke({ color: "#FFFFFF", width: 3 }) }),
    }) }));
    this.modify = new Modify({ source: this.source, pixelTolerance: 8, condition: (event) => primaryAction(event) && (!event.originalEvent.shiftKey || nearRotationHandle(event)), insertVertexCondition: () => false, deleteCondition: () => false });
    this.modify.on("modifyend", () => {
      if (this.objectId !== null && this.edited !== null) commit(this.objectId, this.edited);
      this.edited = null;
    });
    this.source.on("changefeature", (event) => {
      const position = event.feature?.getGeometry()?.getCoordinates();
      if (this.original === null || position === undefined || event.feature === undefined) return;
      this.edited = ellipseFromHandle(this.original, event.feature.get("handle") as EllipseHandle, position, this.shiftHeld);
      preview(ellipsePolygon(this.edited));
    });
    map.addInteraction(this.modify);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.modify.setActive(active);
    if (!active) this.source.clear();
  }

  show(id: string | null, geometry: PackageGeometry | undefined, editable: boolean): void {
    this.source.clear();
    this.edited = null;
    this.objectId = id;
    this.original = geometry?.type === "Ellipse" && editable ? geometry : null;
    if (!this.active || this.original === null) return;
    this.source.addFeatures(ellipseHandles(this.original).map(({ handle, position }) => new Feature({ geometry: new Point(position), handle })));
  }
}
