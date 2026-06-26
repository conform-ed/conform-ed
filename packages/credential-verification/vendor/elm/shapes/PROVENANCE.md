# ELM v3.3 SHACL shapes — vendored for runtime verification

These TTL shape graphs are the consumer-facing subset of the ELM v3.3 SHACL shapes that
`verifyEdc` / `validateAgainstProfile` need at runtime, **exposed via `src/elm-shapes.ts`** so a
downstream consumer (e.g. emergent's wallet/verifier) does not have to vendor them itself. Shapes are
version-pinned, committed artifacts of the **European Learning Model v3.3** (application-profile
`1.1.0`, distribution snapshot `snb-model/20230928-0`).

## Source of truth

Identical to `packages/coverage/vendor/elm/shapes/` — both are written by
`scripts/fetch-elm-artifacts.ts` (the canonical upstream is the pinned EU mirror; see that script and
`packages/coverage/vendor/elm/PROVENANCE.md`). The fetch script copies the consumer subset here after
vendoring coverage, so the two never drift. Regenerate with `bun run scripts/fetch-elm-artifacts.ts`.

## Files (the subset emergent v1 consumes — ADR-0019 / emergent ADR-0047)

- `edc-generic-full.ttl` + `edc-generic-no-cv.ttl` — the EDC verification shape graph. `full`
  `owl:imports` `no-cv`, so the **closure** (both files) is the correct shape set; `validateAgainstProfile`
  strips `owl:imports` and the caller supplies the closure. Exposed as `EDC_GENERIC_FULL_SHAPES`.
- `loq-constraints.ttl` / `ams-constraints.ttl` / `pid-constraints.ttl` — the plain-profile shapes for
  LOQ / AMS / PID validate-only. Exposed as `LOQ_SHAPES` / `AMS_SHAPES` / `PID_SHAPES`.

The `-mdr` and EDC sub-variant shapes (accredited / converted / diploma-supplement / issued-by-mandate)
live only in the coverage package; add them here if variant-aware verification is needed downstream.
