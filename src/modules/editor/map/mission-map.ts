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
import { Circle, Fill, Stroke, Style } from "ol/style";
import type { MissionGeometry, MissionLayerDto, MissionObjectDto, MissionObjectStyle } from "@/modules/missions/missions.api";
import { fromMapGeometry, toMapGeometry } from "./geometry-codec";

export type EditorTool = "select" | "point" | "line" | "polygon";

export interface MissionMapCallbacks {
  onDrawn: (geometry: MissionGeometry) => void;
  onModified: (objectId: string, geometry: MissionGeometry) => void;
  onSelected: (objectId: string | null) => void;
}

const DRAW_TYPES = { point: "Point", line: "LineString", polygon: "Polygon" } as const;
const DEFAULT_CENTER = fromLonLat([10.45, 51.16]);

function withOpacity(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(opacity)})`;
}

function styleFor(style: MissionObjectStyle, selected: boolean): Style[] {
  const width = style.strokeWidth + (selected ? 2 : 0);
  const main = new Style({
    stroke: new Stroke({ color: style.color, width }),
    fill: new Fill({ color: withOpacity(style.color, style.fillOpacity) }),
    image: new Circle({
      radius: selected ? 9 : 7,
      fill: new Fill({ color: style.color }),
      stroke: new Stroke({ color: "#FFFFFF", width: 2 }),
    }),
  });
  // A light halo under the selected object keeps it visible on any base map.
  return selected ? [new Style({ stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: width + 4 }) }), main] : [main];
}

/**
 * OpenLayers adapter of the mission editor (EDITOR.md: map state stays behind this boundary).
 * It renders mission objects, offers select/draw/modify/snap and reports geometry changes as
 * mission GeoJSON. It never talks to the API; the editor decides what to save.
 */
export class MissionMap {
  private readonly source = new VectorSource<Feature<Geometry>>();
  private readonly map: OlMap;
  private readonly select: Select;
  private readonly editable = new Collection<Feature<Geometry>>();
  private readonly modify: Modify;
  private readonly snap: Snap;
  private draw: Draw | null = null;
  private originals = new Map<string, MissionGeometry>();
  private selectedId: string | null = null;

  constructor(target: HTMLElement, private readonly callbacks: MissionMapCallbacks) {
    const vectorLayer = new VectorLayer({
      source: this.source,
      style: (feature) => styleFor(feature.get("missionStyle") as MissionObjectStyle, feature.getId() === this.selectedId),
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
  setContent(layers: MissionLayerDto[], objects: MissionObjectDto[]): void {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    this.originals = new Map(objects.map((object) => [object.id, object.geometry]));
    this.source.clear();
    this.source.addFeatures(
      objects
        .filter((object) => byId.get(object.layerId)?.visible === true)
        .map((object) => {
          const feature = new Feature<Geometry>({ geometry: toMapGeometry(object.geometry) });
          feature.setId(object.id);
          feature.set("missionStyle", object.style);
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
