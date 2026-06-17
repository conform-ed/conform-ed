/**
 * Registry of the Coverage Map sources this package knows how to generate.
 * `file` is the committed map's filename under `maps/`.
 */

import type { SpecSource } from "../src/source";
import { openBadgesV3_0 } from "./open-badges/v3_0";

export interface CoverageMapEntry {
  readonly source: SpecSource;
  readonly file: string;
}

export const COVERAGE_MAPS: readonly CoverageMapEntry[] = [{ source: openBadgesV3_0, file: "open-badges-v3.0.json" }];
