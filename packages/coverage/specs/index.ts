/**
 * Registry of the Coverage Map sources this package knows how to generate.
 * `file` is the committed map's filename under `maps/`.
 */

import type { SpecSource } from "../src/source";
import { caseV1_1 } from "./case/v1_1";
import { clrV2_0 } from "./clr/v2_0";
import { commonCartridgeV1_3 } from "./common-cartridge/v1_3";
import { openBadgesV3_0 } from "./open-badges/v3_0";

export interface CoverageMapEntry {
  readonly source: SpecSource;
  readonly file: string;
}

export const COVERAGE_MAPS: readonly CoverageMapEntry[] = [
  { source: openBadgesV3_0, file: "open-badges-v3.0.json" },
  { source: clrV2_0, file: "clr-v2.0.json" },
  { source: caseV1_1, file: "case-v1.1.json" },
  { source: commonCartridgeV1_3, file: "common-cartridge-v1.3.json" },
];
