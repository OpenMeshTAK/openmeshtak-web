import type MapBrowserEvent from "ol/MapBrowserEvent";
import { primaryAction } from "ol/events/condition";
import Draw, { type Options } from "ol/interaction/Draw";

/** Click-based drawing reserves Shift for tool constraints instead of freehand/box zoom. */
export class ShiftDraw extends Draw {
  private shifted = false;
  get shiftHeld(): boolean { return this.shifted; }

  constructor(options: Options) {
    super({ ...options, condition: primaryAction, freehandCondition: () => false });
  }

  override handleEvent(event: MapBrowserEvent<PointerEvent>): boolean {
    this.shifted = event.originalEvent.shiftKey;
    return super.handleEvent(event);
  }

  override handleDownEvent(event: MapBrowserEvent<PointerEvent>): boolean {
    const handled = super.handleDownEvent(event);
    if (handled && event.originalEvent.shiftKey) event.stopPropagation();
    return handled;
  }
}
