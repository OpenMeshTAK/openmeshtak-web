import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readInstalledLicenses, type LicensePackage } from "./installed-licenses.ts";

/**
 * Writes the third-party notices and a CycloneDX SBOM into `dist/` for release artifacts, which
 * must carry the attribution that third-party licenses require, so Caddy serves them next to the
 * app. Vite bundles only part of the production dependencies; covering all of them keeps the
 * notices complete without tracing the bundle.
 */

const outputDirectory = "dist";

interface Component {
  name: string;
  version: string;
  /** SPDX expression as the package declares it; the license check allowlists every value. */
  license: string;
  homepage: string | undefined;
  path: string;
}

function componentsOf(packages: LicensePackage[]): Component[] {
  return packages.flatMap((item) =>
    item.versions.map((version, index) => ({
      name: item.name,
      version,
      license: item.license,
      homepage: item.homepage,
      path: item.paths[index] ?? item.paths[0] ?? "",
    })),
  );
}

/** LICENSE, COPYING and NOTICE files at the package root, which carry the required attribution. */
function licenseTexts(packagePath: string): string[] {
  const files = readdirSync(packagePath)
    .filter((file) => /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(file))
    .sort();
  return files.map((file) => readFileSync(join(packagePath, file), "utf8").trim());
}

function notices(components: Component[]): string {
  const sections = components.map((component) => {
    const texts = licenseTexts(component.path);
    const body = texts.length > 0 ? texts.join("\n\n") : `The package ships no license file; it declares ${component.license}.`;
    return `${component.name}@${component.version}\nLicense: ${component.license}\n${component.homepage ?? ""}\n\n${body}`;
  });
  return [
    "OpenMeshTak Web third-party notices",
    "",
    "OpenMeshTak Web is licensed under AGPL-3.0-only. It includes the following third-party packages,",
    "each under its own license reproduced below.",
    "",
    ...sections.map((section) => `${"=".repeat(78)}\n${section}\n`),
  ].join("\n");
}

function packageUrl(component: Component): string {
  const name = component.name.startsWith("@") ? `%40${component.name.slice(1)}` : component.name;
  return `pkg:npm/${name}@${component.version}`;
}

function sbom(components: Component[], version: string): object {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: "application",
        name: "openmeshtak-web",
        version,
        licenses: [{ license: { id: "AGPL-3.0-only" } }],
        purl: `pkg:github/OpenMeshTAK/openmeshtak-web@${version}`,
      },
    },
    components: components.map((component) => ({
      type: "library",
      name: component.name,
      version: component.version,
      purl: packageUrl(component),
      licenses: [{ expression: component.license }],
    })),
  };
}

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const components = Object.values(readInstalledLicenses({ production: true }))
  .flatMap(componentsOf)
  .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, "THIRD_PARTY_NOTICES.txt"), notices(components));
writeFileSync(join(outputDirectory, "sbom.cdx.json"), `${JSON.stringify(sbom(components, version), null, 2)}\n`);
process.stdout.write(`Wrote notices and SBOM for ${String(components.length)} packages to ${outputDirectory}/.\n`);
