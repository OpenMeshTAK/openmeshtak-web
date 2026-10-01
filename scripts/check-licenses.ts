import { spawnSync } from "node:child_process";

interface LicensePackage {
  name: string;
  versions: string[];
}

type LicenseReport = Record<string, LicensePackage[]>;

const allowedLicenses = new Set([
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "BlueOak-1.0.0",
  "Unlicense",
]);

/**
 * Exact versions reviewed on 2026-10-04. None of them is part of the browser bundle: they are
 * build/test tooling or server-side code paths of better-auth and vue-router that Vite never
 * imports. Any version change fails this check until it is reviewed again.
 *
 * - MIT-0 / CC0-1.0: public-domain-like CSS data used by jsdom and css parsing.
 * - Python-2.0: argparse, used only by the openapi-typescript code generator.
 * - MPL-2.0: lightningcss, an unmodified native CSS tool executed at build time only.
 * - (MIT OR CC0-1.0): type-fest; OpenMeshTak relies on MIT.
 * - 0BSD: tslib, reached through @simplewebauthn/server of @better-auth/passkey (reviewed 2026-10-05).
 * - pako (MIT AND Zlib), xml-utils (CC0-1.0), zstddec (MIT AND BSD-3-Clause): GeoTIFF decoders
 *   pulled in by OpenLayers. The editor never imports the GeoTIFF source, so they are not
 *   bundled (reviewed 2026-10-05).
 * - CC-BY-4.0: caniuse-lite browser data used by workbox-build while generating the service
 *   worker; it is not part of the shipped app (reviewed 2026-10-06).
 */
const reviewedExceptions = new Map<string, Set<string>>([
  ["0BSD", new Set(["tslib@1.14.1", "tslib@2.8.1"])],
  ["MIT-0", new Set(["@csstools/color-helpers@6.1.2", "@csstools/css-syntax-patches-for-csstree@1.1.15"])],
  ["CC0-1.0", new Set(["mdn-data@2.27.1", "xml-utils@1.10.2"])],
  ["(MIT AND Zlib)", new Set(["pako@2.2.0"])],
  ["MIT AND BSD-3-Clause", new Set(["zstddec@0.2.0"])],
  ["Python-2.0", new Set(["argparse@2.0.1"])],
  ["MPL-2.0", new Set(["lightningcss@1.33.0", "lightningcss-win32-x64-msvc@1.33.0", "lightningcss-linux-x64-gnu@1.33.0"])],
  ["(MIT OR CC0-1.0)", new Set(["type-fest@4.41.0", "type-fest@0.16.0"])],
  // Browserslist data pulled in by workbox-build (vite-plugin-pwa) at build time only (reviewed 2026-10-06).
  ["CC-BY-4.0", new Set(["caniuse-lite@1.0.30001814"])],
]);

const pnpmCli = process.env.npm_execpath;

if (pnpmCli === undefined) {
  throw new Error("npm_execpath is unavailable; run this check through pnpm.");
}

const isJavaScriptCli = /\.(?:c|m)?js$/i.test(pnpmCli);
const command = isJavaScriptCli ? process.execPath : pnpmCli;
const arguments_ = isJavaScriptCli
  ? [pnpmCli, "licenses", "list", "--json"]
  : ["licenses", "list", "--json"];

const result = spawnSync(command, arguments_, {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(
    `Unable to read the installed dependency licenses (status ${String(result.status)}): ${result.stderr}\n`,
  );
  process.exitCode = 1;
} else {
  const report = JSON.parse(result.stdout) as LicenseReport;
  const blocked: string[] = [];

  for (const [license, packages] of Object.entries(report)) {
    if (allowedLicenses.has(license)) {
      continue;
    }

    const exceptions = reviewedExceptions.get(license) ?? new Set<string>();

    for (const dependency of packages) {
      for (const version of dependency.versions) {
        const packageVersion = `${dependency.name}@${version}`;

        if (!exceptions.has(packageVersion)) {
          blocked.push(`${packageVersion} (${license})`);
        }
      }
    }
  }

  if (blocked.length > 0) {
    process.stderr.write(`Blocked dependency licenses:\n${blocked.sort().join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Dependency licenses match the allowlist and reviewed exceptions.\n");
  }
}
