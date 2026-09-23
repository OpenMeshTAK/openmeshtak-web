import type {
  DataPackageDto,
  PackageContentDto,
  PackageLayerDto,
  PackageObjectDto,
} from "@/modules/data-packages/data-packages.api";

/** One branch of the event editor's Data Package -> Layer -> Item tree. */
export interface EventPackageBranch {
  dataPackage: DataPackageDto;
  layers: PackageLayerDto[];
  objects: PackageObjectDto[];
  contents: PackageContentDto[];
}
