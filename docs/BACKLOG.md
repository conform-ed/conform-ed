# Backlog

Ordered, intentionally short. An entry graduates to active work when a real
consumer needs it (named use case), not when it merely sounds useful. Decisions
already made live in `docs/adr/`; this file holds the agreed-but-not-started.

## Shipped

- **`@conform-ed/pci-math-entry`** — the reference PCI (see its README):
  {expression, verdict} record contract, equivalent/literal modes + tolerance,
  pure checker subpath, org.conform-ed.mathEquivalent operator, MathLive
  module behind lazy import(), harness demo via the install model. Brought
  record responses + fieldValue into qti-react core on the way.
- **Generic PCI delivery — hash-pinned catalog + `getState` persistence + PCI
  package module loading** (ADR-0012). `createPciCatalog` (default-deny
  allowlist + `sha256` integrity over the registry's `paths`/`fetchText` seam);
  attempt-store `registerStateCollector` / `interactionStates` /
  `initialInteractionStates` threaded through the runtime + `createPciSkin` for
  suspend/resume; `createPackagePciCatalog` + `parsePciModuleResolution` for
  the PCI modules of a self-contained QTI/CC package (corpus-proven on HMH
  `tap.js`). The emergent consumer opt-in (asset-pipeline-backed tier-2
  catalog) is designed there, not yet built.

## Mid-term

1. **Review-mode semantics** — enforce `allowReview`/`showSolution`/
   `showFeedback` from itemSessionControl in delivery chrome.
2. **Package/manifest loading (items + assets)** — `imsmanifest.xml` → resolve
   the package's items and asset references from a QTI package zip (the PCI
   _module_ slice of this landed with ADR-0012). CC 1.4 embeds QTI 3 packages
   as resources, so this is also the Common Cartridge entry point.
3. **OneRoster interop, sequenced (ADR-0015).** Counterpart-backed lanes for a
   spec that today has only a Coverage Map and no live tester. Order is fixed by
   the observable/opaque asymmetry:
   1. **OneRoster provider Conformance Scanner** — conform-ed-as-consumer,
      `local-reference`, per-requirement assertions off the wire, no counterpart.
      Reuses the OneRoster Coverage Map + the OpenAPI transport-axis walker
      (`OR-TR-1..5`). Highest value, lowest friction.
   2. **`go-oneroster` as the Scanner's validation target** — cheap
      meta-conformance (`go-oneroster : Scanner :: LRSQL : LRS-tester`),
      v1.2-vs-v1.2.
   3. **OneRoster consumer lane (opaque direction)** — serve a real provider,
      observe SUT ingest state via an Adapter. The genuinely counterpart-
      load-bearing cell; drags in the Adapter/state-observation machinery, so
      it follows the Scanner, not precedes it.
      Caliper is parked until a named need (no emitter consumer yet).

## Elsewhere

- Server-side evaluation platform (wasm/SpinKube execution of received code,
  async external-scored pipeline) is an **emergent** track, not conform-ed:
  the standard's only hook is `external-scored` outcomes, which conform-ed
  already represents. Isolation principle agreed: wasm sandbox for executing
  received code; trusted libraries over untrusted data stay in-process.
