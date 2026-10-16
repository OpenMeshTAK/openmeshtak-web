import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Local development only: runs the test files that changes since the merge-base with the base
 * branch can affect. Vitest collects committed, staged, unstaged and untracked files, follows the
 * module graph from every test file, and runs all tests when a `forceRerunTriggers` file from
 * vite.config.ts changes. Without a usable baseline every test runs. CI and releases always run
 * `pnpm test`.
 */
function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function commitExists(ref: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

const requestedBase = process.env.TEST_CHANGED_BASE ?? "";
const base = requestedBase !== "" ? requestedBase : commitExists("origin/main") || !commitExists("main") ? "origin/main" : "main";

let mergeBase: string | undefined;
try {
  mergeBase = git(["merge-base", "HEAD", base]);
} catch {
  mergeBase = undefined;
}

const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
let args: string[];
if (mergeBase === undefined) {
  process.stdout.write(`Changed tests: no merge-base between HEAD and ${base}; running every test.\n`);
  args = ["run"];
} else {
  process.stdout.write(
    `Changed tests compared with ${base} (${mergeBase.slice(0, 12)}): running the test files that import a changed file, `
      + "or every test when dependencies, configuration, the API contract or the test setup changed.\n",
  );
  args = ["run", "--changed", mergeBase, "--passWithNoTests"];
}

const result = spawnSync(process.execPath, [vitest, ...args, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error !== undefined) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
