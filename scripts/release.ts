#!/usr/bin/env bun
/**
 * Unified release script. Updates all publishable package versions, commits,
 * tags, pushes (triggering OCI image CI builds), and publishes npm packages.
 *
 * Usage: bun run scripts/release.ts <version>
 * Example: bun run scripts/release.ts 0.0.8
 *          bun run scripts/release.ts 0.0.8-rc.1
 *
 * Dry-run (no git mutations, no publish): DRY_RUN=1 bun run scripts/release.ts 0.0.8
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const DRY_RUN = process.env.DRY_RUN === "1";

// --- helpers -----------------------------------------------------------------

function run(args: string[], opts: { cwd?: string; capture?: true } = {}): string {
  const label = args.join(" ");
  if (DRY_RUN && !opts.capture) {
    console.log(`[dry-run] ${label}`);
    return "";
  }
  const proc = Bun.spawnSync(args, {
    cwd: opts.cwd ?? ROOT,
    stdout: opts.capture ? "pipe" : "inherit",
    stderr: opts.capture ? "pipe" : "inherit",
  });
  if (proc.exitCode !== 0) {
    const err = opts.capture ? new TextDecoder().decode(proc.stderr) : "";
    throw new Error(`Command failed (exit ${proc.exitCode}): ${label}\n${err}`.trimEnd());
  }
  return opts.capture ? new TextDecoder().decode(proc.stdout).trim() : "";
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function writeJson(path: string, value: Record<string, unknown>): void {
  const formatted = JSON.stringify(value, null, 2) + "\n";
  if (DRY_RUN) {
    console.log(`[dry-run] write ${path} (version → ${(value as { version: string }).version})`);
    return;
  }
  writeFileSync(path, formatted, "utf8");
}

// --- validation --------------------------------------------------------------

const version = process.argv[2];
if (!version) {
  console.error("Usage: bun run scripts/release.ts <version>");
  console.error("Example: bun run scripts/release.ts 0.0.8");
  process.exit(1);
}

const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._+-]+)?$/;
if (!SEMVER_RE.test(version)) {
  console.error(`Invalid version: "${version}". Must match x.y.z or x.y.z-prerelease.`);
  process.exit(1);
}

// Verify working tree is clean before we start mutating anything
const status = run(["git", "status", "--porcelain"], { capture: true });
if (status) {
  console.error("Working tree has uncommitted changes. Commit or stash them first.");
  console.error(status);
  process.exit(1);
}

// Verify tag does not already exist
const existingTag = run(["git", "tag", "-l", version], { capture: true });
if (existingTag === version) {
  console.error(`Tag ${version} already exists.`);
  process.exit(1);
}

// Build every package so each publishable `dist/` is fresh before publishing. Without this a
// package whose dist was never built locally (e.g. a brand-new package) ships src-only, leaving
// its `exports.default`/`types` (which point at dist) dangling for consumers.
console.log("Building all packages...");
run(["bun", "run", "build"]);

// --- discover publishable packages -------------------------------------------

function findPublishablePackages(): { dir: string; pkgPath: string; pkg: Record<string, unknown> }[] {
  const results: { dir: string; pkgPath: string; pkg: Record<string, unknown> }[] = [];
  for (const workspace of ["packages", "apps"]) {
    const wsDir = join(ROOT, workspace);
    let entries: string[];
    try {
      entries = readdirSync(wsDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const pkgPath = join(wsDir, entry, "package.json");
      let pkg: Record<string, unknown>;
      try {
        pkg = readJson(pkgPath);
      } catch {
        continue;
      }
      if (!pkg.private && typeof pkg.name === "string" && typeof pkg.version === "string") {
        results.push({ dir: join(wsDir, entry), pkgPath, pkg });
      }
    }
  }
  return results;
}

const publishable = findPublishablePackages();
if (publishable.length === 0) {
  console.error("No publishable packages found.");
  process.exit(1);
}

console.log(`\nReleasing version ${version}${DRY_RUN ? " (DRY RUN)" : ""}\n`);
console.log("Publishable packages:");
for (const { pkg } of publishable) {
  console.log(`  ${String(pkg.name)}  ${String(pkg.version)} → ${version}`);
}
console.log();

// --- bump versions -----------------------------------------------------------

for (const { pkgPath, pkg } of publishable) {
  pkg.version = version;
  writeJson(pkgPath, pkg);
}

// Update lockfile after version bumps
run(["bun", "install"]);

// --- commit + tag + push ------------------------------------------------------

const changedPkgPaths = publishable.map((p) => p.pkgPath.replace(ROOT + "/", ""));
run(["git", "add", ...changedPkgPaths, "bun.lock"]);
run(["git", "commit", "-m", `chore: release ${version}`]);
run(["git", "tag", version]);

console.log(`Pushing commits and tag ${version}...`);
// Push branch and the specific tag
const branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], { capture: true });
run(["git", "push", "upstream", branch, version]);

console.log(`\nTag ${version} pushed — OCI image CI builds will start automatically.\n`);

// --- publish npm packages in parallel ----------------------------------------

console.log("Publishing npm packages in parallel...\n");

const publishResults = await Promise.allSettled(
  publishable.map(async ({ dir, pkg }) => {
    const label = `${String(pkg.name)}@${version}`;
    if (DRY_RUN) {
      console.log(`[dry-run] bun publish --access public  (cwd: ${dir})`);
      return label;
    }
    const proc = Bun.spawnSync(["bun", "publish", "--access", "public"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = new TextDecoder().decode(proc.stdout);
    const err = new TextDecoder().decode(proc.stderr);
    if (proc.exitCode !== 0) {
      throw new Error(`publish failed for ${label}\n${err}${out}`);
    }
    console.log(`  published ${label}`);
    return label;
  }),
);

let failed = false;
for (const result of publishResults) {
  if (result.status === "rejected") {
    console.error(`\nERROR: ${result.reason}`);
    failed = true;
  }
}

if (failed) {
  console.error("\nOne or more npm publishes failed. The git tag has already been pushed.");
  console.error("Re-run publish manually: bun publish --access public  (from the package directory)");
  process.exit(1);
}

console.log(`\nDone. ${version} released.`);
console.log("OCI images are building in GitHub Actions.");
