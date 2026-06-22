/**
 * `@conform-ed/coverage` — generates the per-`spec:version` Coverage Map defined
 * in conform-ed ADR-0013: the literal information-model inventory (L1) walked
 * from vendored upstream schemas, reconciled against conform-ed's Zod model (L2),
 * cross-linked to a hand-curated conformance catalog (C). Consumed downstream by
 * the emergent product overlay (emergent ADR-0028).
 */

export type {
  ConformanceRequirement,
  CoverageItem,
  CoverageMap,
  CoverageMapMeta,
  CoverageRollup,
  ItemKind,
  ModelledStatus,
  NormativeLevel,
  ReconciliationResidues,
  SchemaLanguage,
  SourceArtifact,
  UsageEdge,
  ValueSetVerdict,
} from "./types";
export type { SpecBindingSource, SpecSource, ValueSetSource } from "./source";
export { type BuildOptions, buildCoverageMap } from "./generate";
export { applyModelled, type ReconcileResult, reconcile } from "./reconcile";
export { type JsonSchema, refDefName, type WalkContext, type WalkResult, walkSchemaTree } from "./walkers/json-schema";
export { type CuratedWalkResult, walkCurated } from "./walkers/curated";
