import type BaseLayer from "ol/layer/Base";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import { fromLonLat, transformExtent } from "ol/proj";
import ImageCanvasSource from "ol/source/ImageCanvas";
import XYZ from "ol/source/XYZ";
import {
  contentImageUrl,
  contentTileUrl,
  type PackageContentDto,
} from "@/modules/data-packages/data-packages.api";

/** Read-only ATAK map content drawn below the editable objects (EDITOR.md). */
export type MapContentItem =
  | {
      id: string;
      layerId: string;
      kind: "tiles";
      tileUrl: string;
      minZoom: number;
      maxZoom: number;
      bounds: number[];
    }
  | {
      id: string;
      layerId: string;
      kind: "image";
      imageUrl: string;
      corners: number[][];
    };

/** Turns a package's content list into map items; content that cannot be displayed is left out. */
export function mapContentItems(
  path: { eventId: string; packageId: string },
  contents: readonly PackageContentDto[],
): MapContentItem[] {
  return contents.flatMap((content): MapContentItem[] => {
    if (content.offlineMap !== null) {
      return [
        {
          id: content.id,
          layerId: content.layerId,
          kind: "tiles",
          tileUrl: contentTileUrl(path, content.id),
          minZoom: content.offlineMap.minZoom,
          maxZoom: content.offlineMap.maxZoom,
          bounds: content.offlineMap.bounds,
        },
      ];
    }
    if (content.rubberSheet !== null) {
      return [
        {
          id: content.id,
          layerId: content.layerId,
          kind: "image",
          imageUrl: contentImageUrl(path, content.id),
          corners: content.rubberSheet.corners,
        },
      ];
    }
    return [];
  });
}

/**
 * Draws a rubber sheet through an affine transform of its lower-left, lower-right and upper-left
 * corners, so rotated sheets keep their ATAK placement. A fourth corner that does not form a
 * parallelogram is approximated; real ATAK exports are near-parallelograms.
 */
function rubberSheetLayer(item: Extract<MapContentItem, { kind: "image" }>): ImageLayer<ImageCanvasSource> {
  const [lowerLeft, lowerRight, , upperLeft] = item.corners.map((corner) => fromLonLat(corner)) as number[][];
  const image = new Image();
  const source = new ImageCanvasSource({
    ratio: 1,
    canvasFunction: (extent, resolution, pixelRatio, size) => {
      const canvas = document.createElement("canvas");
      canvas.width = size[0]!;
      canvas.height = size[1]!;
      const context = canvas.getContext("2d");
      if (context === null || !image.complete || image.naturalWidth === 0 || lowerLeft === undefined || lowerRight === undefined || upperLeft === undefined) {
        return canvas;
      }
      const toPixel = ([x, y]: number[]): [number, number] => [
        ((x! - extent[0]!) / resolution) * pixelRatio,
        ((extent[3]! - y!) / resolution) * pixelRatio,
      ];
      const [llx, lly] = toPixel(lowerLeft);
      const [lrx, lry] = toPixel(lowerRight);
      const [ulx, uly] = toPixel(upperLeft);
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      context.setTransform((lrx - llx) / width, (lry - lly) / width, (llx - ulx) / height, (lly - uly) / height, ulx, uly);
      context.drawImage(image, 0, 0);
      return canvas;
    },
  });
  image.onload = () => source.changed();
  image.src = item.imageUrl;
  return new ImageLayer({ source });
}

function tileLayer(item: Extract<MapContentItem, { kind: "tiles" }>): TileLayer<XYZ> {
  return new TileLayer({
    source: new XYZ({ url: item.tileUrl, minZoom: item.minZoom, maxZoom: item.maxZoom, crossOrigin: null }),
    extent: transformExtent(item.bounds, "EPSG:4326", "EPSG:3857"),
  });
}

/** Area covered by an item in map coordinates, for zooming to the package's content. */
export function mapContentExtent(item: MapContentItem): number[] {
  if (item.kind === "tiles") {
    return transformExtent(item.bounds, "EPSG:4326", "EPSG:3857");
  }
  const points = item.corners.map((corner) => fromLonLat(corner));
  const xs = points.map(([x]) => x!);
  const ys = points.map(([, y]) => y!);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function mapContentLayer(item: MapContentItem): BaseLayer {
  return item.kind === "tiles" ? tileLayer(item) : rubberSheetLayer(item);
}
