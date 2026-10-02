/**
 * Core and Web are released together. A Web build works with every Core of the same major and
 * minor version; patch releases of either side stay compatible.
 */
export function isCompatibleCoreVersion(webVersion: string, coreVersion: string): boolean {
  const webLine = releaseLine(webVersion);
  return webLine !== null && webLine === releaseLine(coreVersion);
}

function releaseLine(version: string): string | null {
  const match = /^(\d+)\.(\d+)\.\d+/.exec(version);
  return match === null ? null : `${match[1] ?? ""}.${match[2] ?? ""}`;
}
