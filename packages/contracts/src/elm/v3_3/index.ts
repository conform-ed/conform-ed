/**
 * ELM v3.3 — European Learning Model contracts (conform-ed ADR-0019).
 *
 * - `core` — the VC-agnostic ELM ontology (shared by all four profiles)
 * - `edc`  — the European Digital Credentials VC envelope + JAdES delivery shape
 * - `loq` / `ams` / `pid` — the plain-dataset profile roots over the core
 */

export * from "./core";
export * from "./edc";
