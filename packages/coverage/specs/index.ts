/**
 * Registry of the Coverage Map sources this package knows how to generate.
 * `file` is the committed map's filename under `maps/`.
 */

import type { SpecSource } from "../src/source";
import { caliperV1_2 } from "./caliper/v1_2";
import { caseV1_1 } from "./case/v1_1";
import { clrV2_0 } from "./clr/v2_0";
import { cmi5V1_0 } from "./cmi5/v1_0";
import { commonCartridgeV1_3 } from "./common-cartridge/v1_3";
import { commonCartridgeV1_4 } from "./common-cartridge/v1_4";
import { ltiV1_3 } from "./lti/v1_3";
import { oneRosterV1_2 } from "./oneroster/v1_2";
import { openBadgesV3_0 } from "./open-badges/v3_0";
import { qtiV2_1 } from "./qti/v2_1";
import { qtiV2_2 } from "./qti/v2_2";
import { qtiV3_0_1 } from "./qti/v3_0_1";

export interface CoverageMapEntry {
  readonly source: SpecSource;
  readonly file: string;
}

export const COVERAGE_MAPS: readonly CoverageMapEntry[] = [
  { source: openBadgesV3_0, file: "open-badges-v3.0.json" },
  { source: clrV2_0, file: "clr-v2.0.json" },
  { source: caseV1_1, file: "case-v1.1.json" },
  { source: commonCartridgeV1_3, file: "common-cartridge-v1.3.json" },
  { source: commonCartridgeV1_4, file: "common-cartridge-v1.4.json" },
  { source: qtiV2_1, file: "qti-v2.1.json" },
  { source: qtiV2_2, file: "qti-v2.2.json" },
  { source: qtiV3_0_1, file: "qti-v3.0.1.json" },
  { source: oneRosterV1_2, file: "oneroster-v1.2.json" },
  { source: caliperV1_2, file: "caliper-v1.2.json" },
  { source: ltiV1_3, file: "lti-v1.3.json" },
  { source: cmi5V1_0, file: "cmi5-v1.0.json" },
];
