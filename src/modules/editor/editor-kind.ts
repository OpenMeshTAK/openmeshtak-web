import type { DataPackageKind } from "@/modules/data-packages/data-packages.api";

/**
 * Missions use the Data Package editor; only the words differ. Publishing a mission is "Sync":
 * the new revision goes to the TAK apps subscribed to the mission.
 */
export interface KindWords {
  /** e.g. "data package" */
  one: string;
  /** e.g. "Data package" */
  One: string;
  /** e.g. "Data packages" */
  Many: string;
  /** e.g. "Publish" */
  Publish: string;
  /** e.g. "Published" */
  Published: string;
  /** e.g. "not published" */
  notPublished: string;
  /** e.g. "Publish first" */
  publishFirst: string;
  /** Event detail tab that lists this kind. */
  tab: string;
}

export function wordsFor(kind: DataPackageKind): KindWords {
  return kind === "mission"
    ? {
        one: "mission",
        One: "Mission",
        Many: "Missions",
        Publish: "Sync",
        Published: "Synced",
        notPublished: "not synced",
        publishFirst: "Sync first",
        tab: "missions",
      }
    : {
        one: "data package",
        One: "Data package",
        Many: "Data packages",
        Publish: "Publish",
        Published: "Published",
        notPublished: "not published",
        publishFirst: "Publish first",
        tab: "data-packages",
      };
}
