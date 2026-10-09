import ImageState from "ol/ImageState";
import type { FeatureLike } from "ol/Feature";
import Icon from "ol/style/Icon";

/** Sources come only from authorized package/shared image endpoints, never an imported URL. */
const cache = new WeakMap<FeatureLike, { url: string; normal: Icon | null; selected: Icon | null }>();
export function uploadedIcon(feature: FeatureLike, url: string | null, selected: boolean): Icon | null {
  if (url == null || !(url.startsWith("/api/v1/events/") || url.startsWith("/api/v1/map/icons/"))) return null;
  let entry = cache.get(feature);
  if (entry?.url !== url) {
    entry = { url, normal: null, selected: null };
    cache.set(feature, entry);
  }
  const variant = selected ? "selected" : "normal";
  let icon = entry[variant];
  if (icon === null) {
    icon = new Icon({ src: url, width: selected ? 36 : 30, declutterMode: "none" });
    entry[variant] = icon;
  }
  return icon.getImageState() === ImageState.ERROR ? null : icon;
}
