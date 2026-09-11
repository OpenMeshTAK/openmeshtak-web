import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Copies the generated OpenAPI contract from a local Core checkout. The Web repository keeps its
 * own committed copy so it builds without the Core repository; pass a path to override the default
 * sibling location.
 */
const source = resolve(process.argv[2] ?? "../openmeshtak/openapi/openapi.json");

if (!existsSync(source)) {
  throw new Error(`OpenAPI contract not found at ${source}.`);
}

copyFileSync(source, resolve("openapi/openapi.json"));
process.stdout.write(`Copied OpenAPI contract from ${source}.\n`);
