import Collection from "ol/Collection";
import Feature from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { isEmpty } from "ol/extent";
import type Geometry from "ol/geom/Geometry";
import { Draw, Modify, Select, Snap } from "ol/interaction";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import type { PackageGeometry, PackageLayerDto, PackageObjectDto } from "@/modules/data-packages/data-packages.api";
import { fromMapGeometry, toMapGeometry } from "./geometry-codec";
import { objectStyle } from "./object-style";

export type EditorTool = "select" | "point" | "line" | "polygon" | "circle";

export interface PackageMapCallbacks {
  onDrawn: (geometry: PackageGeometry) => void;
  onModified: (objectId: string, geometry: PackageGeometry) => void;
  onSelected: (objectId: string | null) => void;
}

const DRAW_TYPES = { point: "Point", line: "LineString", polygon: "Polygon", circle: "Circle" } as const;
const DEFAULT_CENTER = fromLonLat([10.45, 51.16]);

/**
 * OpenLayers adapter of the data package editor (EDITOR.md: map state stays behind this boundary).
 * It renders data package objects, offers select/draw/modify/snap and reports geometry changes as
 * data package GeoJSON. It never talks to the API; the editor decides what to save.
 */
export class PackageMap {
  private readonly source = new VectorSource<Feature<Geometry>>();
  private readonly map: OlMap;
  private readonly select: Select;
  private readonly editable = new Collection<Feature<Geometry>>();
  private readonly modify: Modify;
  private readonly snap: Snap;
  private draw: Draw | null = null;
  private originals = new Map<string, PackageGeometry>();
  private selectedId: string | null = null;

  constructor(target: HTMLElement, private readonly callbacks: PackageMapCallbacks) {
    const vectorLayer = new VectorLayer({
      source: this.source,
      style: (feature, resolution) => objectStyle(feature, resolution, feature.getId() === this.selectedId),
      // Overlapping labels are hidden instead of piling up; markers always stay visible.
      declutter: true,
    });
    this.map = new OlMap({
      target,
      layers: [new TileLayer({ source: new OSM() }), vectorLayer],
      view: new View({ center: DEFAULT_CENTER, zoom: 6 }),
      controls: defaultControls().extend([new ScaleLine()]),
    });

    this.select = new Select({ layers: [vectorLayer], style: null });
    this.select.on("select", () => {
      const feature = this.select.getFeatures().item(0) as Feature<Geometry> | undefined;
      this.highlight(feature === undefined ? null : String(feature.getId()));
      this.callbacks.onSelected(this.selectedId);
    });

    this.modify = new Modify({ features: this.editable });
    this.modify.on("modifyend", (event) => {
      for (const feature of event.features.getArray()) {
        const id = String(feature.getId());
        const geometry = feature.getGeometry();
        if (geometry !== undefined) {
          this.callbacks.onModified(id, fromMapGeometry(geometry, this.originals.get(id)));
        }
      }
    });
    this.snap = new Snap({ source: this.source });

    this.map.addInteraction(this.select);
    this.map.addInteraction(this.modify);
    this.map.addInteraction(this.snap);
  }

  /** Replaces the rendered content. Hidden layers are not drawn; locked layers cannot be modified. */
  setContent(layers: PackageLayerDto[], objects: PackageObjectDto[]): void {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    this.originals = new Map(objects.map((object) => [object.id, object.geometry]));
    this.source.clear();
    this.source.addFeatures(
      objects
        .filter((object) => byId.get(object.layerId)?.visible === true)
        .map((object) => {
          const feature = new Feature<Geometry>({ geometry: toMapGeometry(object.geometry) });
          feature.setId(object.id);
          feature.set("objectStyle", object.style);
          feature.set("kind", object.kind);
          feature.set("name", object.name);
          feature.set("locked", byId.get(object.layerId)?.locked === true);
          return feature;
        }),
    );
    this.highlight(this.selectedId);
  }

  setTool(tool: EditorTool): void {
    if (this.draw !== null) {
      this.map.removeInteraction(this.draw);
      this.draw = null;
    }
    this.select.setActive(tool === "select");
    this.modify.setActive(tool === "select");
    if (tool !== "select") {
      this.draw = new Draw({ type: DRAW_TYPES[tool] });
      this.draw.on("drawend", (event) => {
        const geometry = event.feature.getGeometry();
        if (geometry !== undefined) {
          this.callbacks.onDrawn(fromMapGeometry(geometry));
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
    if (feature !== null) {
      this.select.getFeatures().push(feature);
      if (feature.get("locked") !== true) {
        this.editable.push(feature);
      }
    }
    this.source.changed();
  }

  fitToContent(): void {
    const extent = this.source.getExtent();
    if (extent !== null && !isEmpty(extent)) {
      this.map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 16, duration: 250 });
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
