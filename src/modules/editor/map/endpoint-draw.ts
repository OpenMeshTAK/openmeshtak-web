import type Feature from "ol/Feature";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import LineString from "ol/geom/LineString";
import type { Options } from "ol/interaction/Draw";
import { ShiftDraw } from "./shift-draw";

/** Two clicks finish a distance or route; Shift keeps adding endpoints. */
export class EndpointDraw extends ShiftDraw {
  private sketch: Feature | null = null;

  constructor(options: Options) {
    super({ ...options, type: "LineString", finishCondition: (event) => !event.originalEvent.shiftKey });
    this.on("drawstart", (event) => { this.sketch = event.feature; });
    this.on("drawend", () => { this.sketch = null; });
    this.on("drawabort", () => { this.sketch = null; });
  }

  override handleUpEvent(event: MapBrowserEvent<PointerEvent>): boolean {
    const pass = super.handleUpEvent(event);
    const geometry = this.sketch?.getGeometry();
    // The trailing cursor coordinate makes three positions equal two committed points.
    if (!pass && !event.originalEvent.shiftKey && geometry instanceof LineString && geometry.getCoordinates().length >= 3) this.finishDrawing();
    return pass;
  }
}
