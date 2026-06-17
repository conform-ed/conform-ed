#!/usr/bin/env bun
/**
 * Regenerate (or, with `--check`, verify) the committed Coverage Maps under
 * `maps/`. `--check` is the gate used in CI: it fails if any committed map is
 * stale relative to the current schemas + Zod model.
 *
 * The `generatedAt` date is preserved across runs unless the map's *content*
 * actually changes, so daily regeneration does not churn the committed file.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { COVERAGE_MAPS } from "../specs/index";
import { buildCoverageMap } from "../src/generate";

const mapsDir = join(import.meta.dir, "..", "maps");
const checkOnly = process.argv.includes("--check");

function existingDate(target: string): string | undefined {
  if (!existsSync(target)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(target, "utf8"));
    if (typeof parsed === "object" && parsed !== null && "meta" in parsed) {
      const meta = (parsed as { meta: unknown }).meta;
      if (typeof meta === "object" && meta !== null && "generatedAt" in meta) {
        const date = (meta as { generatedAt: unknown }).generatedAt;
        if (typeof date === "string") return date;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

let drift = false;

for (const { source, file } of COVERAGE_MAPS) {
  const target = join(mapsDir, file);
  const priorDate = existingDate(target);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";

  // Build with the prior date first, so an unchanged map produces byte-identical output.
  const stable = buildCoverageMap(source, priorDate !== undefined ? { now: priorDate } : {});
  const stableJson = serialize(stable);
  const unchanged = stableJson === current;

  if (checkOnly) {
    if (!unchanged) {
      drift = true;
      console.error(`DRIFT: maps/${file} is stale — run \`bun run coverage:generate\``);
    }
    continue;
  }

  const map = unchanged ? stable : buildCoverageMap(source);
  const json = unchanged ? stableJson : serialize(map);
  if (json !== current) {
    writeFileSync(target, json);
    console.log(
      `wrote maps/${file} — ${map.rollup.items} items, ` +
        `${map.rollup.modelledYes} modelled / ${map.rollup.modelledPartial} partial / ` +
        `${map.rollup.modelledNo} gaps, ${map.rollup.conformanceRequirements} conformance reqs`,
    );
  } else {
    console.log(`maps/${file} unchanged`);
  }
}

if (checkOnly && drift) process.exit(1);
