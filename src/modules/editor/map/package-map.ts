import Collection from "ol/Collection";
import Feature from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { extend, isEmpty } from "ol/extent";
import { primaryAction } from "ol/events/condition";
import type Geometry from "ol/geom/Geometry";
import Polygon from "ol/geom/Polygon";
import { Draw, Modify, Select, Snap, Translate } from "ol/interaction";
import type BaseLayer from "ol/layer/Base";
import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat, toLonLat } from "ol/proj";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import type { PackageGeometry, PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import { fromMapGeometry, toMapGeometry } from "./geometry-codec";
import { createLiveLayer, type LiveMapItem } from "./live-layer";
import { mapContentExtent, mapContentLayer, type MapContentItem } from "./map-content";
import { objectPriority, objectStyle, remoteSelectionStyle } from "./object-style";
import { EllipseEditor } from "./ellipse-editor";
import { createEllipseDrawing } from "./ellipse-drawing";
import { createRectangleDrawing } from "./rectangle-drawing";
import { ShiftDraw } from "./shift-draw";
import { EndpointDraw } from "./endpoint-draw";
import { newRoute } from "./route-editing";
import { MeasurementTools } from "./measurement-tools";

export type EditorTool = "select" | "point" | "line" | "freehand" | "polygon" | "circle" | "rectangle" | "ellipse" | "route" | "measure-length" | "measure-area";

/** An object another editor has selected. */
export interface RemoteSelection {
  objectId: string;
  color: string;
  name: string;
}

export interface PackageMapCallbacks {
  onDrawn: (geometry: PackageGeometry) => void;
  onModified: (objectId: string, geometry: PackageGeometry) => void;
  onSelected: (objectId: string | null) => void;
  /** Right click: the object under the cursor (if any), screen position and WGS84 position. */
  onContextMenu: (target: { objectId: string | null; clientX: number; clientY: number; position: number[] }) => void;
}

const DRAW_TYPES = { point: "Point", line: "LineString", freehand: "LineString", polygon: "Polygon", circle: "Circle", rectangle: "Circle", ellipse: "Circle", route: "LineString" } as const;
/** Freehand strokes keep a vertex only where it moves the line by more than this many pixels. */
const FREEHAND_TOLERANCE_PIXELS = 2;
const DEFAULT_CENTER = fromLonLat([10.45, 51.16]);

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${String(character.charCodeAt(0))};`);
}

export function createBaseMapSource(baseMap: {
  tileUrlTemplate: string;
  attribution: string;
  maxZoom: number;
}): XYZ {
  return new XYZ({
    url: baseMap.tileUrlTemplate,
    // Public providers such as OpenStreetMap reject anonymous browser tile traffic. Send only the
    // installation origin cross-site, even when the document's global policy is more restrictive.
    referrerPolicy: "strict-origin-when-cross-origin",
    // Text only: OpenLayers renders attributions as HTML, so the configured text is escaped.
    attributions: escapeHtml(baseMap.attribution),
    attributionsCollapsible: false,
    maxZoom: baseMap.maxZoom,
  });
}

/**
 * OpenLayers adapter of the data package editor. OpenLayers feature state stays behind this
 * boundary so the data package model stays server-owned and independent of the map library.
 * It renders data package objects, offers select/draw/modify/snap and reports geometry changes as
 * data package GeoJSON. It never talks to the API; the editor decides what to save.
 */
export class PackageMap {
  private readonly source = new VectorSource<Feature<Geometry>>();
  private readonly map: OlMap;
  /** Offline maps and rubber sheets, between the base map and the editable objects. */
  private readonly contentGroup = new LayerGroup();
  private readonly contentLayers = new Map<string, BaseLayer>();
  private contentExtents = new Map<string, number[]>();
  private readonly select: Select;
  private readonly editable = new Collection<Feature<Geometry>>();
  private readonly vertexEditable = new Collection<Feature<Geometry>>();
  private readonly ellipseEditor: EllipseEditor;
  private readonly measurements: MeasurementTools;
  private readonly modify: Modify;
  private readonly translate: Translate;
  private readonly snap: Snap;
  private draw: Draw | null = null;
  private originals = new Map<string, PackageGeometry>();
  /** The object each feature was last drawn from, to skip unchanged objects in `setContent`. */
  private readonly drawn = new Map<string, { object: PackageObjectDto; layerKey: string; geometryRevision: number }>();
  private selectedId: string | null = null;
  private canEdit = false;
  private iconUrls = new Map<string, string>();
  /** Objects other editors have selected, with their color and name. */
  private remoteSelections = new Map<string, RemoteSelection>();
  /** Last pointer position over the map in WGS84, used for pasting at the cursor. */
  private pointer: number[] | null = null;
  private readonly live = createLiveLayer();
  /** Gets its source once the configured base map is known, so no other provider loads first. */
  private readonly baseLayer = new TileLayer();

  constructor(target: HTMLElement, private readonly callbacks: PackageMapCallbacks) {
    const vectorLayer = new VectorLayer({
      source: this.source,
      style: (feature, resolution) => {
        const own = objectStyle(feature, resolution, feature.getId() === this.selectedId);
        const remote = this.remoteSelections.get(String(feature.getId()));
        return remote === undefined ? own : [...own, remoteSelectionStyle(feature, remote)];
      },
      // Overlapping labels are hidden instead of piling up; markers always stay visible.
      declutter: true,
    });
    this.map = new OlMap({
      target,
      layers: [this.baseLayer, this.contentGroup, vectorLayer, this.live.layer],
      view: new View({ center: DEFAULT_CENTER, zoom: 6 }),
      // Own class instead of ol-scale-line: the default sits bottom left, under the layer panel.
      controls: defaultControls({ zoom: false }).extend([new ScaleLine({ className: "editor-scale" })]),
    });

    this.select = new Select({ layers: [vectorLayer], style: null });
    this.select.on("select", (event) => {
      const feature = this.topFeatureAtPixel(event.mapBrowserEvent.pixel, vectorLayer);
      this.highlight(feature === undefined ? null : String(feature.getId()));
      this.callbacks.onSelected(this.selectedId);
    });

    this.modify = new Modify({ features: this.vertexEditable,
      condition: (event) => primaryAction(event) && !event.originalEvent.shiftKey,
      insertVertexCondition: () => !["Rectangle", "Route"].includes(this.originals.get(this.selectedId ?? "")?.type ?? ""),
      deleteCondition: (event) => event.originalEvent.altKey && event.type === "singleclick" && !["Rectangle", "Route"].includes(this.originals.get(this.selectedId ?? "")?.type ?? ""),
    });
    this.modify.on("modifyend", (event) => this.reportChanged(event.features.getArray()));
    // Shift bypasses vertex editing, so even a freehand line can be moved from its stroke.
    // The tolerance makes thin strokes selectable without needing an exact pixel hit.
    this.translate = new Translate({ features: this.editable, hitTolerance: 8, condition: primaryAction });
    this.translate.on("translateend", (event) => this.reportChanged(event.features.getArray()));
    this.snap = new Snap({ source: this.source });

    this.map.addInteraction(this.select);
    // Interactions added later see pointer events first, so Modify wins near vertices and edges.
    this.map.addInteraction(this.translate);
    this.map.addInteraction(this.modify);
    this.map.addInteraction(this.snap);
    this.ellipseEditor = new EllipseEditor(this.map,
      (geometry) => this.source.getFeatureById(this.selectedId ?? "")?.setGeometry(geometry),
      (id, geometry) => this.callbacks.onModified(id, geometry),
    );
    this.measurements = new MeasurementTools(this.map);

    this.map.on("pointermove", (event) => {
      this.pointer = toLonLat(event.coordinate);
    });
    this.map.getViewport().addEventListener("mouseleave", () => {
      this.pointer = null;
    });
    this.map.getViewport().addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.openContextMenu(event, vectorLayer);
    });
  }

  private reportChanged(features: Feature<Geometry>[]): void {
    for (const feature of features) {
      const id = String(feature.getId());
      const geometry = feature.getGeometry();
      if (geometry !== undefined) {
        this.callbacks.onModified(id, fromMapGeometry(geometry, this.originals.get(id)));
      }
    }
  }

  private openContextMenu(event: MouseEvent, vectorLayer: VectorLayer): void {
    const pixel = this.map.getEventPixel(event);
    const feature = this.topFeatureAtPixel(pixel, vectorLayer);
    const objectId = feature === undefined ? null : String(feature.getId());
    if (objectId !== null) {
      this.highlight(objectId);
      this.callbacks.onSelected(objectId);
    }
    this.callbacks.onContextMenu({
      objectId,
      clientX: event.clientX,
      clientY: event.clientY,
      position: toLonLat(this.map.getCoordinateFromPixel(pixel)),
    });
  }

  /** Uses the same explicit priority for hit testing as for drawing. */
  private topFeatureAtPixel(pixel: number[], vectorLayer: VectorLayer): Feature<Geometry> | undefined {
    let top: Feature<Geometry> | undefined;
    let topPriority = Number.NEGATIVE_INFINITY;
    this.map.forEachFeatureAtPixel(
      pixel,
      (hit) => {
        const feature = hit as Feature<Geometry>;
        const priority = objectPriority(feature);
        if (priority > topPriority) {
          top = feature;
          topPriority = priority;
        }
        return undefined;
      },
      { layerFilter: (layer) => layer === vectorLayer },
    );
    return top;
  }

  /** WGS84 position of the pointer while it is over the map, otherwise `null`. */
  pointerPosition(): number[] | null {
    return this.pointer;
  }

  /**
   * Shows the given content. Hidden layers are not drawn; locked layers cannot be modified.
   * Unchanged objects keep their map feature, so large packages are not rebuilt on every edit.
   */
  setContent(layers: PackageLayerDto[], objects: PackageObjectDto[]): void {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    // Rank 0 is the bottom layer; higher layers are drawn and hit-tested above lower ones.
    const rank = new Map([...layers].sort((a, b) => a.sortOrder - b.sortOrder).map(({ id }, index) => [id, index]));
    this.originals = new Map(objects.map((object) => [object.id, object.geometry]));
    const shown = new Set<string>();
    const added: Feature<Geometry>[] = [];
    for (const object of objects) {
      const layer = byId.get(object.layerId);
      if (layer?.visible !== true) continue;
      shown.add(object.id);
      const layerRank = rank.get(object.layerId) ?? 0;
      const layerKey = `${String(layerRank)}:${String(layer.locked)}`;
      const feature = this.source.getFeatureById(object.id);
      const drawn = this.drawn.get(object.id);
      if (feature === null || drawn === undefined) {
        const created = new Feature<Geometry>({ geometry: toMapGeometry(object.geometry) });
        created.setId(object.id);
        created.setProperties(this.featureProperties(object, layerRank, layer.locked), true);
        this.remember(object, layerKey, created);
        added.push(created);
        continue;
      }
      const sameObject = drawn.object === object || drawn.object.version === object.version;
      // A failed edit re-sends the same object; the map must then drop the unsaved geometry.
      const untouched = feature.getGeometry()?.getRevision() === drawn.geometryRevision;
      if (sameObject && untouched && drawn.layerKey === layerKey) continue;
      if (!sameObject || !untouched) feature.setGeometry(toMapGeometry(object.geometry));
      feature.setProperties(this.featureProperties(object, layerRank, layer.locked), true);
      feature.changed();
      this.remember(object, layerKey, feature);
    }
    const removed = this.source.getFeatures().filter((feature) => !shown.has(String(feature.getId())));
    for (const feature of removed) this.drawn.delete(String(feature.getId()));
    if (removed.length > 0) this.source.removeFeatures(removed);
    if (added.length > 0) this.source.addFeatures(added);
    this.highlight(this.selectedId);
  }

  private featureProperties(object: PackageObjectDto, layerRank: number, locked: boolean): Record<string, unknown> {
    const iconPath = object.tak?.iconsetPath ?? "";
    return {
      objectStyle: object.style,
      kind: object.kind,
      layerRank,
      name: object.name,
      cotType: object.tak?.cotType ?? null,
      iconsetPath: object.tak?.iconsetPath ?? null,
      packageId: object.packageId,
      iconImageUrl: this.iconUrls.get(`${object.packageId}:${iconPath}`) ?? this.iconUrls.get(`*:${iconPath}`) ?? null,
      routePoints: object.geometry.type === "Route" ? object.geometry.points : null,
      locked,
    };
  }

  private remember(object: PackageObjectDto, layerKey: string, feature: Feature<Geometry>): void {
    this.drawn.set(object.id, { object, layerKey, geometryRevision: feature.getGeometry()?.getRevision() ?? -1 });
  }

  setIconUrls(urls: Map<string, string>): void {
    this.iconUrls = urls;
    for (const feature of this.source.getFeatures()) {
      const iconPath = String(feature.get("iconsetPath") ?? "");
      const url = urls.get(`${String(feature.get("packageId"))}:${iconPath}`) ?? urls.get(`*:${iconPath}`) ?? null;
      if (url !== feature.get("iconImageUrl")) {
        feature.set("iconImageUrl", url, true);
        // Properties do not change the revision on their own; styles are cached per revision.
        feature.changed();
      }
    }
  }

  /**
   * Shows map content of visible layers in layer order. Layers are kept per content ID so tiles
   * and images are not reloaded when only visibility or order changes.
   */
  setMapContent(items: readonly MapContentItem[], layers: readonly PackageLayerDto[]): void {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    const wanted = new Set(items.map(({ id }) => id));
    for (const id of [...this.contentLayers.keys()].filter((id) => !wanted.has(id))) {
      this.contentLayers.delete(id);
    }
    this.contentExtents = new Map(items.map((item) => [item.id, mapContentExtent(item)]));
    const ordered = [...items].sort((a, b) => (byId.get(a.layerId)?.sortOrder ?? 0) - (byId.get(b.layerId)?.sortOrder ?? 0));
    const shown = ordered.map((item) => {
      let layer = this.contentLayers.get(item.id);
      if (layer === undefined) {
        layer = mapContentLayer(item);
        this.contentLayers.set(item.id, layer);
      }
      layer.setVisible(byId.get(item.layerId)?.visible === true && item.visible);
      layer.setOpacity(item.opacity);
      return layer;
    });
    this.contentGroup.getLayers().clear();
    this.contentGroup.getLayers().extend(shown);
  }

  setTool(tool: EditorTool): void {
    if (!this.canEdit && tool !== "select" && tool !== "measure-length" && tool !== "measure-area") tool = "select";
    if (this.draw !== null) {
      this.map.removeInteraction(this.draw);
      this.draw = null;
    }
    this.select.setActive(tool === "select");
    this.modify.setActive(tool === "select");
    this.translate.setActive(tool === "select");
    this.ellipseEditor.setActive(tool === "select");
    this.highlight(this.selectedId);
    const measuring = tool === "measure-length" || tool === "measure-area";
    this.measurements.setTool(measuring ? tool : null);
    if (tool === "measure-length" || tool === "measure-area") {
      this.map.removeInteraction(this.snap);
      this.map.addInteraction(this.snap);
      return;
    }
    if (tool !== "select") {
      // Freehand draws while the mouse button is held and is saved as an ordinary line.
      const freehand = tool === "freehand";
      const constrained = () => this.draw instanceof ShiftDraw && this.draw.shiftHeld;
      const ellipseDrawing = tool === "ellipse" ? createEllipseDrawing(constrained) : null;
      if (tool === "route") {
        this.draw = new EndpointDraw({ type: "LineString", stopClick: true });
      } else if (tool === "rectangle" || tool === "ellipse") {
        this.draw = new ShiftDraw({ type: "Circle", stopClick: true, geometryFunction: ellipseDrawing?.geometryFunction ?? createRectangleDrawing(constrained) });
      } else {
        // Freeform lines/areas finish normally by double-click; Shift never enables freehand.
        this.draw = new Draw({ type: DRAW_TYPES[tool], freehand, freehandCondition: () => false });
      }
      this.draw.on("drawend", (event) => {
        const drawn = event.feature.getGeometry();
        const resolution = this.map.getView().getResolution() ?? 1;
        const geometry = freehand && drawn !== undefined ? drawn.simplify(resolution * FREEHAND_TOLERANCE_PIXELS) : drawn;
        if (geometry !== undefined) {
          if (tool === "ellipse") {
            const ellipse = ellipseDrawing?.current();
            if (ellipse != null) this.callbacks.onDrawn(ellipse);
          } else if (tool === "rectangle" && geometry instanceof Polygon) {
            const coordinates = geometry.getCoordinates()[0]?.slice(0, 4) ?? [];
            this.callbacks.onDrawn({ type: "Rectangle", coordinates: coordinates.map((p) => toLonLat(p).slice(0, 2)) });
          } else {
            const converted = fromMapGeometry(geometry);
            this.callbacks.onDrawn(tool === "route" && converted.type === "LineString" ? newRoute(converted.coordinates) : converted);
          }
        }
      });
      // Snap must be added after Draw so it can adjust the drawn vertices.
      this.map.removeInteraction(this.snap);
      this.map.addInteraction(this.draw);
      this.map.addInteraction(this.snap);
    }
  }

  /** Selects an object, e.g. from the object list, and makes it modifiable unless locked. */
  highlight(objectId: string | null): void {
    this.selectedId = objectId;
    const feature = objectId === null ? null : this.source.getFeatureById(objectId);
    this.select.getFeatures().clear();
    this.editable.clear();
    this.vertexEditable.clear();
    if (feature !== null) {
      this.select.getFeatures().push(feature);
      if (this.canEdit && feature.get("locked") !== true) {
        this.editable.push(feature);
        if (this.originals.get(objectId ?? "")?.type !== "Ellipse") this.vertexEditable.push(feature);
      }
    }
    this.ellipseEditor.show(objectId, this.originals.get(objectId ?? ""), this.canEdit && feature !== null && feature.get("locked") !== true);
    this.source.changed();
  }

  fitToContent(): void {
    const candidates = [...this.contentExtents.values(), this.source.getExtent(), this.live.layer.getSource()?.getExtent() ?? null].filter(
      (candidate): candidate is number[] => candidate !== null && !isEmpty(candidate),
    );
    const extent = candidates.reduce<number[] | null>(
      (combined, candidate) => (combined === null ? [...candidate] : extend(combined, candidate)),
      null,
    );
    if (extent !== null) {
      this.map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 16, duration: 250 });
    }
  }

  clearMeasurements(): void { this.measurements.clear(); }

  setEditable(editable: boolean): void {
    this.canEdit = editable;
    this.highlight(this.selectedId);
  }

  /** Zooms to one offline map or rubber sheet. */
  zoomToContent(contentId: string): void {
    const extent = this.contentExtents.get(contentId);
    if (extent !== undefined && !isEmpty(extent)) {
      this.map.getView().fit(extent, { padding: [48, 48, 48, 48], duration: 250 });
    }
  }

  /** The online base map from the installation settings, with the provider's attribution. */
  setBaseMap(baseMap: { tileUrlTemplate: string; attribution: string; maxZoom: number }): void {
    this.baseLayer.setSource(createBaseMapSource(baseMap));
  }

  /** Shows which objects other editors have selected. */
  setRemoteSelections(selections: readonly RemoteSelection[]): void {
    this.remoteSelections = new Map(selections.map((selection) => [selection.objectId, selection]));
    this.source.changed();
  }

  /** Live TAK positions and markers, drawn above all package content. */
  setLiveItems(items: readonly LiveMapItem[]): void {
    this.live.update(items);
  }

  /** Centres the map on one live item without changing the zoom more than needed. */
  zoomToLive(uid: string): void {
    const position = this.live.positionOf(uid);
    if (position !== null) {
      this.map.getView().animate({ center: position, zoom: Math.max(this.map.getView().getZoom() ?? 14, 14), duration: 250 });
    }
  }

  /** Recalculates the size after the surrounding layout changed, e.g. a panel was resized. */
  updateSize(): void {
    this.map.updateSize();
  }

  dispose(): void {
    this.map.setTarget(undefined);
  }
}
